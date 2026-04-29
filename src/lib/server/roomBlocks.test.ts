import { describe, expect, it } from 'vitest';

import {
	addDaysToDateString,
	buildRoomBlockTimestamp,
	createRoomBlocks,
	evaluateRoomAvailabilityAtStart,
	RoomBlockHttpError,
	type RoomAvailabilityContext,
	type SqlQueryFn
} from './roomBlocks';

describe('evaluateRoomAvailabilityAtStart', () => {
	it('matches rooms by slot minute and applies full-session room blocks', () => {
		const context: RoomAvailabilityContext = {
			rooms: [
				{ id: 1, locationId: 67, name: 'Hel timme', halfHourStart: false, active: true },
				{ id: 2, locationId: 67, name: 'Halvtimme', halfHourStart: true, active: true }
			],
			bookings: [{ roomId: 1, startTime: '2026-04-18 15:00:00', status: 'New' }],
			roomBlocks: [
				{
					roomId: 2,
					startTime: '2026-04-18 15:00:00',
					endTime: '2026-04-18 16:30:00'
				}
			]
		};

		const fullHour = evaluateRoomAvailabilityAtStart({
			context,
			startTime: '2026-04-18 15:00:00'
		});
		expect(fullHour.matchingRoomIds).toEqual([1]);
		expect(fullHour.bookedRoomIds).toEqual([1]);
		expect(fullHour.availableRoomIds).toEqual([]);

		const halfHourBlocked = evaluateRoomAvailabilityAtStart({
			context,
			startTime: '2026-04-18 15:30:00'
		});
		expect(halfHourBlocked.matchingRoomIds).toEqual([2]);
		expect(halfHourBlocked.blockedRoomIds).toEqual([2]);
		expect(halfHourBlocked.availableRoomIds).toEqual([]);

		const halfHourFreed = evaluateRoomAvailabilityAtStart({
			context,
			startTime: '2026-04-18 16:30:00'
		});
		expect(halfHourFreed.matchingRoomIds).toEqual([2]);
		expect(halfHourFreed.availableRoomIds).toEqual([2]);
		expect(halfHourFreed.selectedRoomId).toBe(2);
	});

	it('ignores cancelled bookings and honors a preferred available room', () => {
		const context: RoomAvailabilityContext = {
			rooms: [
				{ id: 10, locationId: 70, name: 'Rum 10', halfHourStart: false, active: true },
				{ id: 11, locationId: 70, name: 'Rum 11', halfHourStart: false, active: true }
			],
			bookings: [
				{ roomId: 10, startTime: '2026-04-18 10:00:00', status: 'Cancelled' },
				{ roomId: 11, startTime: '2026-04-18 10:00:00', status: 'New' }
			],
			roomBlocks: []
		};

		const result = evaluateRoomAvailabilityAtStart({
			context,
			startTime: '2026-04-18 10:00:00',
			preferredRoomId: 10
		});

		expect(result.matchingRoomIds).toEqual([10, 11]);
		expect(result.bookedRoomIds).toEqual([11]);
		expect(result.availableRoomIds).toEqual([10]);
		expect(result.selectedRoomId).toBe(10);
	});

	it('only blocks a location when every matching room is blocked for the full session', () => {
		const context: RoomAvailabilityContext = {
			rooms: [
				{ id: 2, locationId: 68, name: 'Träningsrum 1', halfHourStart: true, active: true },
				{ id: 6, locationId: 68, name: 'Träningsrum 2', halfHourStart: true, active: true }
			],
			bookings: [],
			roomBlocks: [
				{
					roomId: 2,
					startTime: '2026-05-01 10:00:00',
					endTime: '2026-05-01 18:00:00'
				},
				{
					roomId: 6,
					startTime: '2026-05-01 13:00:00',
					endTime: '2026-05-01 22:00:00'
				}
			]
		};

		const beforeOverlap = evaluateRoomAvailabilityAtStart({
			context,
			startTime: '2026-05-01 12:30:00'
		});
		expect(beforeOverlap.blockedRoomIds).toEqual([2]);
		expect(beforeOverlap.availableRoomIds).toEqual([6]);
		expect(beforeOverlap.selectedRoomId).toBe(6);

		const duringOverlap = evaluateRoomAvailabilityAtStart({
			context,
			startTime: '2026-05-01 13:30:00'
		});
		expect(duringOverlap.blockedRoomIds).toEqual([2, 6]);
		expect(duringOverlap.availableRoomIds).toEqual([]);
		expect(duringOverlap.selectedRoomId).toBeNull();

		const afterOverlap = evaluateRoomAvailabilityAtStart({
			context,
			startTime: '2026-05-01 18:30:00'
		});
		expect(afterOverlap.blockedRoomIds).toEqual([6]);
		expect(afterOverlap.availableRoomIds).toEqual([2]);
		expect(afterOverlap.selectedRoomId).toBe(2);
	});
});

describe('room block helpers', () => {
	it('adds days across month boundaries', () => {
		expect(addDaysToDateString('2026-01-28', 7)).toBe('2026-02-04');
		expect(addDaysToDateString('2026-12-28', 7)).toBe('2027-01-04');
	});

	it('normalizes Stockholm timestamps for inserts', () => {
		expect(buildRoomBlockTimestamp('2026-04-18', '6:30')).toBe('2026-04-18 06:30:00');
		expect(buildRoomBlockTimestamp('2026-04-18', '16:00')).toBe('2026-04-18 16:00:00');
	});
});

describe('createRoomBlocks', () => {
	it('creates weekly copies through the inclusive repeat-until date', async () => {
		const insertedPayloads: Array<{
			roomId: number;
			startTime: string;
			endTime: string;
			reason: string | null;
			addedById: number;
		}> = [];

		let nextId = 10;
		const queryFn: SqlQueryFn = async (text, params = []) => {
			if (text.includes('FROM rooms')) {
				return [{ id: 8, location_id: 67 }];
			}

			if (text.includes('INSERT INTO unavailable_rooms')) {
				insertedPayloads.push({
					roomId: Number(params[0]),
					startTime: String(params[1]),
					endTime: String(params[2]),
					reason: (params[3] as string | null) ?? null,
					addedById: Number(params[4])
				});
				return [{ id: nextId++ }];
			}

			if (text.includes('WHERE ur.id = ANY')) {
				const ids = (params[0] as number[]) ?? [];
				return insertedPayloads.map((payload, index) => ({
					id: ids[index],
					room_id: payload.roomId,
					room_name: `Rum ${payload.roomId}`,
					room_half_hour_start: false,
					start_time: payload.startTime,
					end_time: payload.endTime,
					reason: payload.reason,
					added_by_id: payload.addedById,
					added_by_firstname: 'Test',
					added_by_lastname: 'User',
					created_at: null,
					updated_at: null
				}));
			}

			return [];
		};

		const created = await createRoomBlocks(
			{
				roomId: 8,
				locationId: 67,
				startDate: '2026-05-01',
				startTime: '10:00',
				endDate: '2026-05-01',
				endTime: '12:00',
				reason: 'Maintenance',
				repeatWeekly: true,
				repeatUntil: '2026-05-15',
				addedById: 4
			},
			queryFn
		);

		expect(insertedPayloads).toEqual([
			{
				roomId: 8,
				startTime: '2026-05-01 10:00:00',
				endTime: '2026-05-01 12:00:00',
				reason: 'Maintenance',
				addedById: 4
			},
			{
				roomId: 8,
				startTime: '2026-05-08 10:00:00',
				endTime: '2026-05-08 12:00:00',
				reason: 'Maintenance',
				addedById: 4
			},
			{
				roomId: 8,
				startTime: '2026-05-15 10:00:00',
				endTime: '2026-05-15 12:00:00',
				reason: 'Maintenance',
				addedById: 4
			}
		]);
		expect(created.map((row) => row.id)).toEqual([10, 11, 12]);
	});

	it('rejects missing repeat-until when repeatWeekly is enabled', async () => {
		await expect(
			createRoomBlocks(
				{
					roomId: 8,
					locationId: 67,
					startDate: '2026-05-01',
					startTime: '10:00',
					endDate: '2026-05-01',
					endTime: '12:00',
					reason: 'Maintenance',
					repeatWeekly: true,
					repeatUntil: '',
					addedById: 4
				},
				(async () => []) as SqlQueryFn
			)
		).rejects.toMatchObject<Partial<RoomBlockHttpError>>({
			status: 400,
			errors: {
				repeatUntil: 'Ange sista datum för upprepningen'
			}
		});
	});

	it('rejects end times that are not later than start times', async () => {
		await expect(
			createRoomBlocks(
				{
					roomId: 8,
					locationId: 67,
					startDate: '2026-05-01',
					startTime: '10:00',
					endDate: '2026-05-01',
					endTime: '10:00',
					reason: 'Maintenance',
					addedById: 4
				},
				(async () => []) as SqlQueryFn
			)
		).rejects.toMatchObject<Partial<RoomBlockHttpError>>({
			status: 400,
			errors: {
				endTime: 'Sluttiden måste vara senare än starttiden'
			}
		});
	});
});
