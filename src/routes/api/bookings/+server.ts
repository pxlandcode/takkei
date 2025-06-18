import { query } from '$lib/db';

export async function GET({ url }) {
	const fromDate = url.searchParams.get('from');
	const toDate = url.searchParams.get('to');
	const date = url.searchParams.get('date');
	const includeCancelled = url.searchParams.get('includeCancelled') === 'true';

	const roomId = url.searchParams.get('roomId');
	const locationIds = url.searchParams.getAll('locationId');
	const trainerIds = url.searchParams.getAll('trainerId');
	const clientId = url.searchParams.get('clientId');

	// ✅ Optional Pagination
	const limitParam = url.searchParams.get('limit');
	const offsetParam = url.searchParams.get('offset');

	const limit = limitParam ? parseInt(limitParam) : null;
	const offset = offsetParam ? parseInt(offsetParam) : 0;

	const params: (string | number | number[])[] = [];
	let queryStr = `
        SELECT bookings.*, 
               rooms.name AS room_name, 
               locations.name AS location_name,
               locations.color AS location_color,
               users.firstname AS trainer_firstname,
               users.lastname AS trainer_lastname,
               clients.firstname AS client_firstname,
               clients.lastname AS client_lastname,
               booking_contents.id AS booking_content_id,
               booking_contents.kind AS booking_content_kind
        FROM bookings
        LEFT JOIN rooms ON bookings.room_id = rooms.id
        LEFT JOIN locations ON bookings.location_id = locations.id
        LEFT JOIN users ON bookings.trainer_id = users.id
        LEFT JOIN clients ON bookings.client_id = clients.id
        LEFT JOIN booking_contents ON bookings.booking_content_id = booking_contents.id
        WHERE 1=1
    `;

	// ✅ Exclude cancelled bookings by default
	if (!includeCancelled) {
		queryStr += ` AND bookings.status NOT IN ('Cancelled', 'Late_cancelled')`;
	}

	// ✅ Date range filtering
	if (fromDate && toDate) {
		params.push(fromDate, toDate);
		queryStr += ` AND bookings.start_time BETWEEN TO_DATE($${params.length - 1}, 'YYYY-MM-DD') 
                      AND TO_DATE($${params.length}, 'YYYY-MM-DD')`;
	} else if (date) {
		params.push(date);
		queryStr += ` AND DATE(bookings.start_time) = TO_DATE($${params.length}, 'YYYY-MM-DD')`;
	}

	// ✅ Additional filters
	let hasTrainer = trainerIds.length > 0;
	let hasClient = !!clientId;
	let hasLocation = locationIds.length > 0;

	let orConditions: string[] = [];

	// Individual filter conditions pushed to the OR group
	if (hasTrainer) {
		params.push(trainerIds.map(Number));
		orConditions.push(`bookings.trainer_id = ANY($${params.length}::int[])`);
	}
	if (hasClient) {
		params.push(Number(clientId));
		orConditions.push(`bookings.client_id = $${params.length}`);
	}
	if (hasLocation) {
		params.push(locationIds.map(Number));
		orConditions.push(`bookings.location_id = ANY($${params.length}::int[])`);
	}

	// Add OR group only if there's at least one filter
	if (orConditions.length > 0) {
		queryStr += ` AND (${orConditions.join(' OR ')})`;
	}
	// ✅ Apply pagination *only* if `limit` is set
	if (limit !== null) {
		queryStr += ` ORDER BY bookings.start_time DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
		params.push(limit, offset);
	} else {
		queryStr += ` ORDER BY bookings.start_time DESC`; // No limit, return all results
	}

	try {
		const result = await query(queryStr, params);
		return new Response(JSON.stringify(result), { status: 200 });
	} catch (error) {
		console.error('Error fetching bookings:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
