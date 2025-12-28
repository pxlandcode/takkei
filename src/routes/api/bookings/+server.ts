import { query } from '$lib/db';

function parseTimestamp(value: any): number | undefined {
	if (!value) return undefined;
	if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
	if (typeof value === 'string') {
		const normalized = value.replace(' ', 'T');
		const withZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
		const ms = Date.parse(withZone);
		if (!Number.isNaN(ms)) return ms;
	}
	const ms = Date.parse(String(value));
	return Number.isNaN(ms) ? undefined : ms;
}

export async function GET({ url, request }) {
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

	const sort = url.searchParams.get('sort') ?? 'desc';

	const params: (string | number | number[])[] = [];
	let queryStr = `
        SELECT bookings.*, 
               COALESCE(bn.notes_count, 0) AS linked_note_count,
               rooms.name AS room_name, 
               locations.name AS location_name,
               locations.color AS location_color,
               users.firstname AS trainer_firstname,
               users.lastname AS trainer_lastname,
               clients.firstname AS client_firstname,
               clients.lastname AS client_lastname,
               booking_contents.id AS booking_content_id,
               booking_contents.kind AS booking_content_kind,
               trainee.id AS trainee_id,
               trainee.firstname AS trainee_firstname,
               trainee.lastname AS trainee_lastname
        FROM bookings
        LEFT JOIN (
          SELECT booking_id, COUNT(*) AS notes_count
          FROM booking_notes
          GROUP BY booking_id
        ) bn ON bn.booking_id = bookings.id
        LEFT JOIN rooms ON bookings.room_id = rooms.id
        LEFT JOIN locations ON bookings.location_id = locations.id
        LEFT JOIN users ON bookings.trainer_id = users.id
        LEFT JOIN clients ON bookings.client_id = clients.id
        LEFT JOIN users AS trainee ON bookings.user_id = trainee.id
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
	} else if (fromDate) {
		params.push(fromDate);
		queryStr += ` AND bookings.start_time >= TO_DATE($${params.length}, 'YYYY-MM-DD')`;
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
		// Include bookings where the user is the trainer OR the trainee (user_id)
		// for praktiktimme (internal_education) and utbildning (education) bookings
		orConditions.push(
			`(bookings.trainer_id = ANY($${params.length}::int[]) OR (bookings.user_id = ANY($${params.length}::int[]) AND (bookings.internal_education = true OR bookings.education = true)))`
		);
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
		queryStr += ` ORDER BY bookings.start_time ${sort.toUpperCase()} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
		params.push(limit, offset);
	} else {
		queryStr += ` ORDER BY bookings.start_time ${sort.toUpperCase()}`;
	}

	try {
		const result = await query(queryStr, params);

		const maxUpdatedMs = result
			.map((row) => row?.updated_at || row?.updatedAt || row?.created_at || row?.createdAt)
			.map((ts) => parseTimestamp(ts))
			.filter((n): n is number => Number.isFinite(n))
			.sort((a, b) => b - a)[0];

		let effectiveUpdatedMs = maxUpdatedMs;
		if (!Number.isFinite(effectiveUpdatedMs)) {
			const trainerIdNums = trainerIds.map(Number).filter(Boolean);
			const fallbackParams: (number[] | undefined)[] = [];
			let fallbackQuery = `SELECT MAX(updated_at) AS last_updated FROM bookings`;
			if (trainerIdNums.length > 0) {
				fallbackParams.push(trainerIdNums);
				fallbackQuery += ` WHERE trainer_id = ANY($1::int[]) OR user_id = ANY($1::int[])`;
			}
			const [row] = await query<{ last_updated: string | null }>(fallbackQuery, fallbackParams);
			effectiveUpdatedMs = parseTimestamp(row?.last_updated) ?? 0;
		}

		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		const roundedMs = Number.isFinite(effectiveUpdatedMs)
			? Math.floor(effectiveUpdatedMs / 1000) * 1000
			: 0;
		headers['Last-Modified'] = new Date(roundedMs).toUTCString();

		const ifModifiedSince = request.headers.get('if-modified-since');
		if (ifModifiedSince) {
			const since = Date.parse(ifModifiedSince);
			if (Number.isFinite(since) && since >= roundedMs) {
				return new Response(null, { status: 304, headers });
			}
		}

		return new Response(JSON.stringify(result), { status: 200, headers });
	} catch (error) {
		console.error('Error fetching bookings:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
