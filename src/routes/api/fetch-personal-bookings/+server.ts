import { query } from '$lib/db';

export async function GET({ url }) {
	const fromDate = url.searchParams.get('from');
	const toDate = url.searchParams.get('to');
	const date = url.searchParams.get('date');

	const userIds = url.searchParams.getAll('trainerId');

	const params: (string | number | number[])[] = [];
	let queryStr = `
        SELECT personal_bookings.*, 
               users.firstname AS user_firstname,
               users.lastname AS user_lastname
        FROM personal_bookings
        LEFT JOIN users ON personal_bookings.user_id = users.id
        WHERE 1=1
    `;

	// Date range filtering
	if (fromDate && toDate) {
		params.push(fromDate, toDate);
		queryStr += ` AND personal_bookings.start_time BETWEEN TO_DATE($${params.length - 1}, 'YYYY-MM-DD') 
                      AND TO_DATE($${params.length}, 'YYYY-MM-DD')`;
	} else if (date) {
		params.push(date);
		queryStr += ` AND DATE(personal_bookings.start_time) = TO_DATE($${params.length}, 'YYYY-MM-DD')`;
	}

	// Filtering by `user_ids`
	if (userIds.length > 0) {
		params.push(userIds.map(Number));
		queryStr += ` AND personal_bookings.user_ids @> ARRAY[$${params.length}::int[]]`;

		if (userIds.length > 3) {
			queryStr += ` AND personal_bookings.kind = 'Meeting'`;
		}
	}

	try {
		console.log('Executing Personal Bookings Query:', queryStr, params);
		const result = await query(queryStr, params);
		return new Response(JSON.stringify(result), { status: 200 });
	} catch (error) {
		console.error('Error fetching personal bookings:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
