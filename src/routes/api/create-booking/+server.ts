import * as db from '$lib/db';
import { findUserTravelConflict } from '$lib/server/bookingTravelConflict';
import { resolvePackageAssignmentForCreate } from '$lib/server/createBookingPackageAssignment';
import {
	bookingConsumesPackage,
	getStockholmYmd,
	isChargeablePackageBookingStatus
} from '$lib/server/packageSemantics';
import type { RequestHandler } from '@sveltejs/kit';
import type { PoolClient } from 'pg';

type SqlClient = Pick<PoolClient, 'query'>;
const pool = (db as any).pool as { connect: () => Promise<PoolClient> };

function toIntOrNull(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const n = Number(value);
	if (!Number.isFinite(n)) return null;
	return Math.trunc(n);
}

function toBool(value: unknown) {
	return value === true || value === 'true' || value === 1 || value === '1';
}

async function txQuery(client: SqlClient, text: string, params: unknown[] = []) {
	return (await (db as any).queryWithClient(client as PoolClient, text, params)) as any[];
}

export const POST: RequestHandler = async ({ request }) => {
	const dbClient = await pool.connect();
	let transactionStarted = false;

	try {
		const data = await request.json();

		const rawClientId = toIntOrNull(data.client_id);
		const rawPackageId = toIntOrNull(data.package_id);
		const rawRoomId = toIntOrNull(data.room_id);
		const rawTrainerId = toIntOrNull(data.trainer_id);
		const rawLocationId = toIntOrNull(data.location_id);
		const rawCreatedById = toIntOrNull(data.created_by_id);
		const rawBookingContentId = toIntOrNull(data.booking_content_id);
		const rawRepeatIndex = toIntOrNull(data.repeat_index);
		const rawUserId = toIntOrNull(data.user_id);
		const status = typeof data.status === 'string' && data.status.trim() ? data.status : 'New';
		const start_time =
			typeof data.start_time === 'string' && data.start_time.trim()
				? data.start_time
				: new Date().toISOString();
		const refund_comment = data.refund_comment ?? null;
		const cancel_reason = data.cancel_reason ?? null;
		const cancel_time = data.cancel_time ?? null;
		const added_to_package_date = data.added_to_package_date ?? null;
		const added_to_package_by = toIntOrNull(data.added_to_package_by);
		const location_name = data.location_name ?? null;
		const actual_cancel_time = data.actual_cancel_time ?? null;

		const internal_education = toBool(data.internal_education);
		let try_out = toBool(data.try_out);
		let internal = toBool(data.internal);
		let education = toBool(data.education);
		let client_id = rawClientId;

		if (internal_education) {
			if (!rawUserId) {
				return new Response(JSON.stringify({ error: 'user_id is required for Praktiktimme' }), {
					status: 422
				});
			}
			client_id = null;
			try_out = false;
		}

		if (education) {
			client_id = null;
			try_out = false;
			internal = false;
		}

		const bookingNeedsPackage = bookingConsumesPackage({ internal, education, try_out });
		const bookingIsChargeable = isChargeablePackageBookingStatus(status);
		const bookingCheckYmd = getStockholmYmd(start_time) ?? getStockholmYmd(new Date());

		if (!bookingCheckYmd) {
			return new Response(JSON.stringify({ error: 'Invalid booking time' }), { status: 400 });
		}

		await dbClient.query('BEGIN');
		transactionStarted = true;

		const packageAssignment = await resolvePackageAssignmentForCreate({
			client: dbClient,
			clientId: client_id,
			explicitPackageId: rawPackageId,
			bookingNeedsPackage,
			bookingIsChargeable,
			checkYmd: bookingCheckYmd,
			initialAddedToPackageDate: added_to_package_date
		});

		let selectedRoomId = rawRoomId;
		const hasLocation = rawLocationId !== null && rawLocationId !== undefined;
		const hasStartTime = Boolean(start_time);

		const trainerTravelConflict = await findUserTravelConflict({
			queryFn: (text, params = []) => txQuery(dbClient, text, params),
			userId: rawTrainerId,
			targetStartTime: start_time,
			targetLocationId: rawLocationId
		});
		if (trainerTravelConflict) {
			await dbClient.query('ROLLBACK');
			transactionStarted = false;
			return new Response(
				JSON.stringify({
					error: 'Trainer has insufficient travel time between locations.',
					conflict: trainerTravelConflict,
					conflictRole: 'trainer'
				}),
				{ status: 400 }
			);
		}

		if ((internal_education || education) && rawUserId && rawUserId !== rawTrainerId) {
			const traineeTravelConflict = await findUserTravelConflict({
				queryFn: (text, params = []) => txQuery(dbClient, text, params),
				userId: rawUserId,
				targetStartTime: start_time,
				targetLocationId: rawLocationId
			});
			if (traineeTravelConflict) {
				await dbClient.query('ROLLBACK');
				transactionStarted = false;
				return new Response(
					JSON.stringify({
						error: 'Selected trainee has insufficient travel time between locations.',
						conflict: traineeTravelConflict,
						conflictRole: 'trainee'
					}),
					{ status: 400 }
				);
			}
		}

		if (!hasLocation) {
			selectedRoomId = null;
		} else if (selectedRoomId) {
			const validRoom = await txQuery(
				dbClient,
				`SELECT id FROM rooms WHERE id = $1 AND location_id = $2 AND active = true`,
				[selectedRoomId, rawLocationId]
			);
			if (!validRoom.length) {
				selectedRoomId = null;
			}
		}

		if (hasLocation && hasStartTime) {
			if (selectedRoomId) {
				const roomConflict = await txQuery(
					dbClient,
					`
					SELECT 1 FROM bookings
					WHERE room_id = $1
					  AND start_time = $2
					  AND (status IS NULL OR LOWER(status) NOT IN ('cancelled', 'late_cancelled'))
					LIMIT 1
					`,
					[selectedRoomId, start_time]
				);
				if (roomConflict.length) {
					selectedRoomId = null;
				}
			}

			if (!selectedRoomId) {
				const availableRooms = await txQuery(
					dbClient,
					`
					SELECT r.id FROM rooms r
					WHERE r.location_id = $1
					AND r.active = true
					AND NOT EXISTS (
						SELECT 1 FROM bookings b
						WHERE b.room_id = r.id
						AND b.start_time = $2
						AND (b.status IS NULL OR LOWER(b.status) NOT IN ('cancelled', 'late_cancelled'))
					)
					ORDER BY r.id ASC
					LIMIT 1
					`,
					[rawLocationId, start_time]
				);

				if (availableRooms.length === 0) {
					await dbClient.query('ROLLBACK');
					transactionStarted = false;
					return new Response(JSON.stringify({ error: 'No available room at this time.' }), {
						status: 400
					});
				}

				selectedRoomId = Number(availableRooms[0].id);
			}
		}

		const result = await txQuery(
			dbClient,
			`
			INSERT INTO bookings 
				(client_id, package_id, room_id, trainer_id, status, start_time, location_id, created_by_id, booking_content_id, refund_comment, repeat_index, try_out, cancel_reason, cancel_time, added_to_package_date, education, internal, user_id, added_to_package_by, booking_without_room, location_name, actual_cancel_time, internal_education, created_at, updated_at)
			VALUES
				($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW())
			RETURNING id
			`,
			[
				client_id,
				packageAssignment.packageId,
				selectedRoomId,
				rawTrainerId,
				status,
				start_time,
				rawLocationId,
				rawCreatedById,
				rawBookingContentId,
				refund_comment,
				rawRepeatIndex,
				try_out,
				cancel_reason,
				cancel_time,
				packageAssignment.addedToPackageDate,
				education,
				internal,
				rawUserId,
				added_to_package_by,
				!selectedRoomId,
				location_name,
				actual_cancel_time,
				internal_education
			]
		);

		await dbClient.query('COMMIT');
		transactionStarted = false;

		const bookingId = result[0].id;

		return new Response(
			JSON.stringify({
				message: 'Booking created successfully',
				bookingId,
				package_assignment: {
					status: packageAssignment.status,
					package_id: packageAssignment.packageId
				}
			}),
			{
				status: 201
			}
		);
	} catch (error) {
		if (transactionStarted) {
			try {
				await dbClient.query('ROLLBACK');
			} catch (rollbackError) {
				console.error('Failed to rollback create booking transaction:', rollbackError);
			}
		}

		console.error('Error creating booking:', error);
		return new Response(JSON.stringify({ error: (error as Error).message }), {
			status: 500
		});
	} finally {
		dbClient.release();
	}
};
