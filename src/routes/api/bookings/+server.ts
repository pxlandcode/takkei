import { query } from '$lib/db';

export async function GET({ url }) {
	const fromDate = url.searchParams.get('from');
	const toDate = url.searchParams.get('to');
	const date = url.searchParams.get('date'); // If no range is given, get a single date

	const roomId = url.searchParams.get('roomId');
	const locationIds = url.searchParams.getAll('locationId');
	const trainerId = url.searchParams.get('trainerId');
	const clientId = url.searchParams.get('clientId');

	let queryStr = `
        SELECT bookings.*, 
               rooms.name AS room_name, 
               locations.name AS location_name,
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

	const params: (string | number | number[])[] = [];

	// date range
	if (fromDate && toDate) {
		params.push(fromDate, toDate);
		queryStr += ` AND bookings.start_time BETWEEN TO_DATE($${params.length - 1}, 'YYYY-MM-DD') 
                      AND TO_DATE($${params.length}, 'YYYY-MM-DD')`;
	} else if (date) {
		params.push(date);
		queryStr += ` AND DATE(bookings.start_time) = TO_DATE($${params.length}, 'YYYY-MM-DD')`;
	} else {
		const today = new Date().toISOString().slice(0, 10);
		params.push(today);
		queryStr += ` AND DATE(bookings.start_time) = TO_DATE($${params.length}, 'YYYY-MM-DD')`;
	}

	// ✅ Additional filters
	if (roomId) {
		params.push(Number(roomId));
		queryStr += ` AND bookings.room_id = $${params.length}`;
	}
	if (locationIds.length > 0) {
		params.push(locationIds.map(Number));
		queryStr += ` AND bookings.location_id = ANY($${params.length}::int[])`;
	}
	if (trainerId) {
		params.push(Number(trainerId));
		queryStr += ` AND bookings.trainer_id = $${params.length}`;
	}
	if (clientId) {
		params.push(Number(clientId));
		queryStr += ` AND bookings.client_id = $${params.length}`;
	}

	try {
		console.log('Executing Query:', queryStr, params);
		const result = await query(queryStr, params);
		return new Response(JSON.stringify(result), { status: 200 });
	} catch (error) {
		console.error('Error fetching bookings:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
