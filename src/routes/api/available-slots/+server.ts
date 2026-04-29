import { query } from '$lib/db';
import {
	addDaysToDateString,
	buildRoomBlockTimestamp,
	evaluateRoomAvailabilityAtStart,
	loadLocationRoomAvailabilityContext
} from '$lib/server/roomBlocks';
import { extractStockholmMinutes } from '$lib/server/stockholm-time';
import type { RequestHandler } from '@sveltejs/kit';

const SLOT_LENGTH_MINUTES = 60;
const TRAVEL_BUFFER_MINUTES = 25;
// Total buffer needed before a booking start_time at a different location
// (slot duration + travel time = 60 + 25 = 85 minutes)
const TOTAL_BUFFER_BEFORE_BOOKING = SLOT_LENGTH_MINUTES + TRAVEL_BUFFER_MINUTES;

type Interval = { start: number; end: number };
	type LocationInterval = Interval & { locationId: number | null };
type AvailableSlotsBlockedReason = 'absence' | 'vacation';

function isNotNull<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}

function extractTime(timeStr: string): number {
	const [h, m] = timeStr.split(':').map(Number);
	return h * 60 + m;
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
	return startA < endB && startB < endA;
}

function hasTravelConflictForIntervals(
	slotStart: number,
	slotEnd: number,
	locationId: number,
	bookings: LocationInterval[]
): boolean {
	return bookings.some((booking) => {
		if (booking.locationId === null || booking.locationId === locationId) return false;

		if (overlaps(slotStart, slotEnd, booking.start, booking.end)) {
			return true;
		}

		if (booking.end <= slotStart) {
			return slotStart - booking.end < TRAVEL_BUFFER_MINUTES;
		}

		if (booking.start >= slotEnd) {
			return booking.start - slotEnd < TRAVEL_BUFFER_MINUTES;
		}

		return false;
	});
}

function jsonResponse(
	availableSlots: string[],
	outsideAvailabilitySlots: string[],
	blockedReason: AvailableSlotsBlockedReason | null = null
) {
	return new Response(
		JSON.stringify({
			availableSlots,
			outsideAvailabilitySlots,
			blockedReason
		})
	);
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const {
		date,
		trainerId,
		locationId,
		checkUsersBusy = false,
		userId = null,
		ignoreBookingId = null
	} = body;
	const trainerIdNumber = Number(trainerId);
	const locationIdNumber = Number(locationId);
	const bookingIdToIgnore =
		ignoreBookingId !== undefined && ignoreBookingId !== null && ignoreBookingId !== ''
			? Number(ignoreBookingId)
			: null;

	if (!date || Number.isNaN(trainerIdNumber) || Number.isNaN(locationIdNumber)) {
		return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
	}

	const dayStart = `${date} 00:00:00`;
	const dayEnd = `${date} 23:59:59`;
	const targetDate = new Date(date);
	let blockedReason: AvailableSlotsBlockedReason | null = null;

	// 1. Absences
	const absences = await query(
		`SELECT 1 FROM absences
       WHERE user_id = $1
         AND start_time <= $3
         AND (end_time IS NULL OR end_time >= $2)`,
		[trainerIdNumber, dayStart, dayEnd]
	);
	if (absences.length > 0) {
		blockedReason = 'absence';
	}

	// 2. Vacations (same)
	if (!blockedReason) {
		const vacations = await query(
			`SELECT 1 FROM vacations
     WHERE user_id = $1 AND start_date <= $2 AND end_date >= $2`,
			[trainerIdNumber, date]
		);
		if (vacations.length > 0) {
			blockedReason = 'vacation';
		}
	}

	// 3. Date or Weekly Availability (same)
	const dateAvailabilities = await query(
		`SELECT start_time, end_time FROM date_availabilities
     WHERE user_id = $1 AND date = $2 AND available = true`,
		[trainerIdNumber, date]
	);

	let availability = dateAvailabilities.map((a) => ({
		from: extractTime(a.start_time),
		to: extractTime(a.end_time)
	}));

	if (availability.length === 0) {
		const weekday = targetDate.getDay(); // Matches DB convention Sun=0 .. Sat=6
		const weekly = await query(
			`SELECT start_time, end_time FROM weekly_availabilities WHERE user_id = $1 AND weekday = $2`,
			[trainerIdNumber, weekday]
		);
		availability = weekly.map((a) => ({
			from: extractTime(a.start_time),
			to: extractTime(a.end_time)
		}));

		if (availability.length === 0) {
			availability = [{ from: 0, to: 24 * 60 }];
		}
	}

	const roomAvailabilityContext = await loadLocationRoomAvailabilityContext({
		locationId: locationIdNumber,
		windowStart: `${date} 00:00:00`,
		windowEnd: `${addDaysToDateString(date, 1)} 00:00:00`,
		ignoreBookingId: bookingIdToIgnore
	});

	if (roomAvailabilityContext.rooms.length === 0) {
		return jsonResponse([], []);
	}

	const trainerBookings = await query(
		`SELECT id, start_time, location_id FROM bookings
     WHERE start_time BETWEEN $1 AND $2
       AND LOWER(status) NOT IN ('cancelled', 'late_cancelled')
       AND trainer_id = $3
       AND ($4::int IS NULL OR id <> $4)`,
		[dayStart, dayEnd, trainerIdNumber, bookingIdToIgnore]
	);

	// 5b. Bookings where the trainer is a TRAINEE (praktiktimme/education)
	// This blocks the trainer's time when they are being trained
	const trainerAsTraineeBookings = await query(
		`SELECT id, start_time, location_id FROM bookings
     WHERE start_time BETWEEN $1 AND $2
       AND LOWER(status) NOT IN ('cancelled', 'late_cancelled')
       AND user_id = $3
       AND (internal_education = true OR education = true)
       AND ($4::int IS NULL OR id <> $4)`,
		[dayStart, dayEnd, trainerIdNumber, bookingIdToIgnore]
	);

	// 6. Trainer personal bookings (same)
	const personalBookings = await query(
		`SELECT start_time, end_time FROM personal_bookings
     WHERE start_time BETWEEN $1 AND $2
       AND (user_id = $3 OR $3 = ANY(user_ids))`,
		[dayStart, dayEnd, trainerIdNumber]
	);

	const trainerPersonalIntervals: Interval[] = personalBookings
		.map((row: any) => {
			const start = extractStockholmMinutes(row.start_time);
			const end = extractStockholmMinutes(row.end_time);
			if (start === null || end === null) return null;
			return { start, end };
		})
		.filter(isNotNull);

	// 7. Selected trainee/user busy intervals (only when asked)
	let traineeIntervals: Interval[] = [];
	let traineeLocationIntervals: LocationInterval[] = [];
	if (checkUsersBusy && userId) {
		const [traineePersonal, traineeBookings] = await Promise.all([
			query(
				`SELECT start_time, end_time FROM personal_bookings
         WHERE start_time BETWEEN $1 AND $2
           AND (user_id = $3 OR $3 = ANY(user_ids))`,
				[dayStart, dayEnd, userId]
			),
			query(
				`SELECT start_time, location_id FROM bookings
         WHERE start_time BETWEEN $1 AND $2
           AND LOWER(status) NOT IN ('cancelled', 'late_cancelled')
           AND (
             trainer_id = $3
             OR (user_id = $3 AND (internal_education = true OR education = true))
           )
           AND ($4::int IS NULL OR id <> $4)`,
				[dayStart, dayEnd, userId, bookingIdToIgnore]
			)
		]);

		const traineePersonalIntervals = traineePersonal
			.map((row: any) => {
				const start = extractStockholmMinutes(row.start_time);
				const end = extractStockholmMinutes(row.end_time);
				if (start === null || end === null) return null;
				return { start, end };
			})
			.filter(isNotNull);

		traineeLocationIntervals = traineeBookings
			.map((row: any): LocationInterval | null => {
				const start = extractStockholmMinutes(row.start_time);
				if (start === null) return null;
				return {
					start,
					end: start + SLOT_LENGTH_MINUTES,
					locationId: row.location_id === null ? null : Number(row.location_id)
				};
			})
			.filter(isNotNull);

		traineeIntervals = [
			...traineePersonalIntervals,
			...traineeLocationIntervals.map(({ start, end }) => ({ start, end }))
		];
	}

	// Bookings where trainer is the trainer (for location-based travel checks)
	const trainerLocationIntervals: LocationInterval[] = trainerBookings
		.map((row: any): LocationInterval | null => {
			const start = extractStockholmMinutes(row.start_time);
			if (start === null) return null;
			return {
				start,
				end: start + SLOT_LENGTH_MINUTES,
				locationId: row.location_id === null ? null : Number(row.location_id)
			};
		})
		.filter(isNotNull);

	// Bookings where trainer is a trainee (praktiktimme/education) - also need location for travel
	const trainerAsTraineeLocationIntervals: LocationInterval[] = trainerAsTraineeBookings
		.map((row: any): LocationInterval | null => {
			const start = extractStockholmMinutes(row.start_time);
			if (start === null) return null;
			return {
				start,
				end: start + SLOT_LENGTH_MINUTES,
				locationId: row.location_id === null ? null : Number(row.location_id)
			};
		})
		.filter(isNotNull);

	// Combined location intervals for travel time checks (trainer as trainer + trainer as trainee)
	const allTrainerLocationIntervals: LocationInterval[] = [
		...trainerLocationIntervals,
		...trainerAsTraineeLocationIntervals
	];

	const trainerBookingIntervals: Interval[] = trainerLocationIntervals.map(({ start, end }) => ({
		start,
		end
	}));

	// Time intervals where trainer is busy as a trainee
	const trainerAsTraineeIntervals: Interval[] = trainerAsTraineeLocationIntervals.map(
		({ start, end }) => ({
			start,
			end
		})
	);

	const availableSlots: string[] = [];
	const outsideAvailabilitySlots: string[] = [];

	for (let h = 5; h <= 21; h++) {
		for (const m of [0, 30]) {
			const slotStart = h * 60 + m;
			const slotEnd = slotStart + SLOT_LENGTH_MINUTES;
			const label = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

			const roomAvailability = evaluateRoomAvailabilityAtStart({
				context: roomAvailabilityContext,
				startTime: buildRoomBlockTimestamp(date, label)
			});
			if (roomAvailability.availableRoomIds.length === 0) continue;

			// trainer availability window
			const insideAvailability = availability.some((a) =>
				overlaps(slotStart, slotEnd, a.from, a.to)
			);

			const trainerClientBookingConflict = trainerBookingIntervals.some((interval) =>
				overlaps(slotStart, slotEnd, interval.start, interval.end)
			);
			if (trainerClientBookingConflict) continue;

			// Trainer busy as a trainee in praktiktimme/education
			const trainerAsTraineeConflict = trainerAsTraineeIntervals.some((interval) =>
				overlaps(slotStart, slotEnd, interval.start, interval.end)
			);
			if (trainerAsTraineeConflict) continue;

			// trainer personal / meetings
			const trainerConflict = trainerPersonalIntervals.some((b) =>
				overlaps(slotStart, slotEnd, b.start, b.end)
			);
			if (trainerConflict) continue;

			// NEW: trainee conflicts (only when asked)
			if (checkUsersBusy && userId) {
				const traineeConflict = traineeIntervals.some((b) =>
					overlaps(slotStart, slotEnd, b.start, b.end)
				);
				if (traineeConflict) continue;
			}

			// Travel time conflicts - check both trainer-as-trainer and trainer-as-trainee bookings
			// Need 85 minutes (60 min slot + 25 min travel) buffer between bookings at different locations
			const travelConflict = hasTravelConflictForIntervals(
				slotStart,
				slotEnd,
				locationIdNumber,
				allTrainerLocationIntervals
			);
			if (travelConflict) continue;

			if (checkUsersBusy && userId) {
				const traineeTravelConflict = hasTravelConflictForIntervals(
					slotStart,
					slotEnd,
					locationIdNumber,
					traineeLocationIntervals
				);
				if (traineeTravelConflict) continue;
			}

			if (insideAvailability && !blockedReason) {
				availableSlots.push(label);
			} else {
				outsideAvailabilitySlots.push(label);
			}
		}
	}

	return jsonResponse(availableSlots, outsideAvailabilitySlots, blockedReason);
};
