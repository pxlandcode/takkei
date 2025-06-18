import { query } from '$lib/db';

export async function GET() {
	const sql = `
		SELECT 
			l.id AS location_id,
			l.name AS location_name,
			l.color,
			r.id AS room_id,
			r.name AS room_name,
			r.half_hour_start,
			r.active AS room_active
		FROM locations l
		LEFT JOIN rooms r ON r.location_id = l.id
		ORDER BY l.name ASC, r.name ASC
	`;

	try {
		const rows = await query(sql);

		// Group rooms under their corresponding locations
		const grouped = new Map();

		for (const row of rows) {
			if (!grouped.has(row.location_id)) {
				grouped.set(row.location_id, {
					id: row.location_id,
					name: row.location_name,
					color: row.color,
					rooms: []
				});
			}

			if (row.room_id) {
				grouped.get(row.location_id).rooms.push({
					id: row.room_id,
					name: row.room_name,
					half_hour_start: row.half_hour_start,
					active: row.room_active
				});
			}
		}

		return new Response(JSON.stringify(Array.from(grouped.values())), { status: 200 });
	} catch (error) {
		console.error('Error fetching locations with rooms:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
export async function POST({ request }) {
	const { name, color } = await request.json();

	if (!name?.trim() || !color) {
		return new Response(JSON.stringify({ error: 'Name and color are required' }), { status: 400 });
	}

	try {
		// 1. Create the location
		const result = await query(
			`INSERT INTO locations (name, color, created_at, updated_at)
			 VALUES ($1, $2, now(), now())
			 RETURNING id`,
			[name.trim(), color]
		);

		const locationId = result[0].id;

		// 2. Create default room
		await query(
			`INSERT INTO rooms (name, location_id, half_hour_start, active, created_at, updated_at)
			 VALUES ($1, $2, true, true, now(), now())`,
			['Standardrum', locationId]
		);

		return new Response(JSON.stringify({ success: true, id: locationId }), { status: 201 });
	} catch (error) {
		console.error('Error creating location and room:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
