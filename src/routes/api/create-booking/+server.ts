import { query } from '$lib/db';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();

		// Extract booking details from request
		const {
			client_id = null,
			package_id = null,
			room_id = null,
			trainer_id = null,
			status = 'New',
			start_time = new Date().toISOString(),
			location_id = null,
			created_by_id = null,
			booking_content_id = null,
			refund_comment = null,
			repeat_index = null,
			try_out = false,
			cancel_reason = null,
			cancel_time = null,
			added_to_package_date = null,
			education = false,
			internal = false,
			user_id = null,
			added_to_package_by = null,
			booking_without_room = false,
			location_name = null,
			actual_cancel_time = null,
			internal_education = false
		} = data;

		const isRegularTraining = !try_out && !internal_education && !education && !internal;
		let resolvedPackageId = package_id;
		let resolvedAddedToPackageDate = added_to_package_date;

		if (!resolvedPackageId && isRegularTraining && client_id) {
			resolvedPackageId = await findAvailablePackageForClient(client_id);
			if (resolvedPackageId && !resolvedAddedToPackageDate) {
				resolvedAddedToPackageDate = new Date();
			}
		}

		if (internal_education) {
			if (!user_id) {
				return new Response(JSON.stringify({ error: 'user_id is required for Praktiktimme' }), {
					status: 422
				});
			}
			data.client_id = null;
			data.try_out = false;
		}

		if (data.education) {
			// Utbildningstimme:
			data.client_id = null;
			data.try_out = false;
			data.internal = false;
		}

		// 🔍 Auto-select room if not provided
		let selectedRoomId = room_id;

		if (!selectedRoomId && location_id && start_time) {
			const availableRooms = await query(
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
				[location_id, start_time]
			);

			if (availableRooms.length === 0) {
				return new Response(JSON.stringify({ error: 'No available room at this time.' }), {
					status: 400
				});
			}

			selectedRoomId = availableRooms[0].id;
		}

		const result = await query(
			`
			INSERT INTO bookings 
				(client_id, package_id, room_id, trainer_id, status, start_time, location_id, created_by_id, booking_content_id, refund_comment, repeat_index, try_out, cancel_reason, cancel_time, added_to_package_date, education, internal, user_id, added_to_package_by, booking_without_room, location_name, actual_cancel_time, internal_education, created_at, updated_at)
			VALUES
				($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW())
			RETURNING id
			`,
			[
				client_id,
				resolvedPackageId,
				selectedRoomId,
				trainer_id,
				status,
				start_time,
				location_id,
				created_by_id,
				booking_content_id,
				refund_comment,
				repeat_index,
				try_out,
				cancel_reason,
				cancel_time,
				resolvedAddedToPackageDate,
				education,
				internal,
				user_id,
				added_to_package_by,
				!selectedRoomId,
				location_name,
				actual_cancel_time,
				internal_education
			]
			);

		const bookingId = result[0].id;

		return new Response(JSON.stringify({ message: 'Booking created successfully', bookingId }), {
			status: 201
		});
	} catch (error) {
		console.error('Error creating booking:', error);
		return new Response(JSON.stringify({ error: (error as Error).message }), {
			status: 500
		});
	}
};

async function findAvailablePackageForClient(clientId: number): Promise<number | null> {
	const directPackages = await query(
		`
			SELECT
				p.id,
				p.frozen_from_date,
				a.sessions,
				(
					SELECT COUNT(*)::int
					FROM bookings b
					WHERE b.package_id = p.id
						AND (b.status IS NULL OR LOWER(b.status) NOT IN ('cancelled', 'late_cancelled'))
				) AS used_sessions
			FROM packages p
			LEFT JOIN articles a ON a.id = p.article_id
			WHERE p.client_id = $1
			ORDER BY p.id ASC
		`,
		[clientId]
	);

	const directMatch = pickPackageWithCapacity(directPackages);
	if (directMatch) return directMatch;

	const customerRows = await query(
		`
			SELECT customer_id
			FROM client_customer_relationships
			WHERE client_id = $1
				AND active = TRUE
		`,
		[clientId]
	);

	const uniqueCustomerIds = Array.from(
		new Set(
			customerRows
				.map((row: any) => row.customer_id)
				.filter((id: number | null) => typeof id === 'number')
		)
	);

	if (!uniqueCustomerIds.length) return null;

	const sharedPackages = await query(
		`
			SELECT
				p.id,
				p.frozen_from_date,
				a.sessions,
				(
					SELECT COUNT(*)::int
					FROM bookings b
					WHERE b.package_id = p.id
						AND (b.status IS NULL OR LOWER(b.status) NOT IN ('cancelled', 'late_cancelled'))
				) AS used_sessions
			FROM packages p
			LEFT JOIN articles a ON a.id = p.article_id
			WHERE p.client_id IS NULL
				AND p.customer_id = ANY($1::int[])
			ORDER BY p.id ASC
		`,
		[uniqueCustomerIds]
	);

	return pickPackageWithCapacity(sharedPackages);
}

function pickPackageWithCapacity(rows: any[]): number | null {
	if (!Array.isArray(rows) || rows.length === 0) return null;
	const now = new Date();

	for (const row of rows) {
		const freezeDate = row.frozen_from_date ? new Date(row.frozen_from_date) : null;
		if (freezeDate && !Number.isNaN(freezeDate.getTime()) && freezeDate <= now) {
			continue;
		}

		const totalSessions =
			row.sessions === null || row.sessions === undefined ? null : Number(row.sessions);
		const usedSessions = Number(row.used_sessions ?? 0);

		if (Number.isNaN(usedSessions)) {
			continue;
		}

		if (totalSessions === null) {
			return row.id;
		}

		if (Number.isNaN(totalSessions) || totalSessions <= 0) {
			continue;
		}

		if (usedSessions < totalSessions) {
			return row.id;
		}
	}

	return null;
}
