import { query } from '$lib/db';
import { respondJsonWithEtag } from '$lib/server/http-cache';

export async function GET({ url, request }) {
	const fromDate = url.searchParams.get('from');
	let toDate = url.searchParams.get('to');
	const date = url.searchParams.get('date');

	const userIds = url.searchParams.getAll('trainerId').map(Number).filter(Boolean);

	// ✅ Optional Pagination
	const limitParam = url.searchParams.get('limit');
	const offsetParam = url.searchParams.get('offset');

	const limit = limitParam ? parseInt(limitParam) : null;
	const offset = offsetParam ? parseInt(offsetParam) : 0;

	const params: (string | number | number[])[] = [];
	let queryStr = `
        SELECT personal_bookings.*, 
               users.firstname AS user_firstname,
               users.lastname AS user_lastname
        FROM personal_bookings
        LEFT JOIN users ON personal_bookings.user_id = users.id
        WHERE 1=1
    `;

	// ✅ Date range filtering
	if (fromDate && toDate) {
		params.push(fromDate, toDate);
		queryStr += ` AND personal_bookings.start_time BETWEEN TO_DATE($${params.length - 1}, 'YYYY-MM-DD') 
                      AND TO_DATE($${params.length}, 'YYYY-MM-DD')`;
	} else if (date) {
		params.push(date);
		queryStr += ` AND DATE(personal_bookings.start_time) = TO_DATE($${params.length}, 'YYYY-MM-DD')`;
	}

	// ✅ Filtering by `trainerId`
	if (userIds.length > 0) {
		params.push(userIds);
		const index = params.length;
		queryStr += ` AND (
            personal_bookings.user_id = ANY($${index}::int[])
            OR personal_bookings.user_ids && $${index}::int[]
        )`;
	}

	// ✅ Apply ORDER BY
	queryStr += ` ORDER BY personal_bookings.start_time DESC`;

	// ✅ Apply pagination only if `limit` is set
	if (limit !== null) {
		params.push(limit, offset);
		queryStr += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
	}

	try {
		const result = await query(queryStr, params);
		return respondJsonWithEtag(request, result);
	} catch (error) {
		console.error('Error fetching personal bookings:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
