import { query } from '$lib/db';

export async function GET({ url }) {
	const week = url.searchParams.get('week');
	const day = url.searchParams.get('day');
	const roomId = url.searchParams.get('roomId');
	const locationId = url.searchParams.get('locationId');
	const trainerId = url.searchParams.get('trainerId');
	const clientId = url.searchParams.get('clientId');

	let queryStr = `
        SELECT bookings.*, 
               rooms.name AS room_name, 
               locations.name AS location_name,
               users.firstname AS trainer_firstname,
               users.lastname AS trainer_lastname,
               clients.firstname AS client_firstname,
               clients.lastname AS client_lastname
        FROM bookings
        LEFT JOIN rooms ON bookings.room_id = rooms.id
        LEFT JOIN locations ON bookings.location_id = locations.id
        LEFT JOIN users ON bookings.trainer_id = users.id
        LEFT JOIN clients ON bookings.client_id = clients.id
        WHERE 1=1
    `;

	const params: (string | number)[] = [];

	if (week) {
		queryStr += ` AND DATE_TRUNC('week', bookings.start_time) = DATE_TRUNC('week', TO_TIMESTAMP($${params.length + 1}, 'YYYY-MM-DD'))`;
		params.push(week);
	}
	if (day) {
		queryStr += ` AND DATE(bookings.start_time) = $${params.length + 1}::DATE`;
		params.push(day);
	}
	if (roomId) {
		queryStr += ` AND bookings.room_id = $${params.length + 1}`;
		params.push(Number(roomId));
	}
	if (locationId) {
		queryStr += ` AND bookings.location_id = $${params.length + 1}`;
		params.push(Number(locationId));
	}
	if (trainerId) {
		queryStr += ` AND bookings.trainer_id = $${params.length + 1}`;
		params.push(Number(trainerId));
	}
	if (clientId) {
		queryStr += ` AND bookings.client_id = $${params.length + 1}`;
		params.push(Number(clientId));
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
