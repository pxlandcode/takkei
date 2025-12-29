// src/routes/api/clients/+server.ts
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
	const customerId = url.searchParams.get('customerId');
	const short = url.searchParams.get('short') === 'true';
	const available = url.searchParams.get('available') === 'true';

	// New filtering/sorting/pagination options
	const search = url.searchParams.get('search')?.trim() || '';
	const sortBy = url.searchParams.get('sortBy') || 'name'; // name | email | trainer
	const sortOrder = url.searchParams.get('sortOrder')?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
	const limit = parseInt(url.searchParams.get('limit') || '5000', 10);
	const offset = parseInt(url.searchParams.get('offset') || '0', 10);
	const trainerId = url.searchParams.get('trainerId');
	const active = url.searchParams.get('active'); // 'true' | 'false' | undefined
	const trialEligible = url.searchParams.get('trialEligible'); // 'true' | 'false' | undefined
	const trialLookbackDays = parseInt(url.searchParams.get('trialLookbackDays') || '365', 10);
	const trialSinceIso = new Date(
		Date.now() - trialLookbackDays * 24 * 60 * 60 * 1000
	).toISOString();

	const params: any[] = [];
	let paramIndex = 1;

	// --- 1. SELECT ---
	let sql = `
    SELECT clients.id, clients.firstname, clients.lastname, clients.primary_location_id, locations.name AS primary_location
  `;

	if (!short) {
		sql += `,
      clients.email,
      clients.phone,
      clients.active,
      clients.membership_status,
      clients.primary_trainer_id,
      users.id AS trainer_id,
      users.firstname AS trainer_firstname,
      users.lastname AS trainer_lastname
    `;
	}

	sql += `
    FROM clients
    LEFT JOIN users ON clients.primary_trainer_id = users.id
    LEFT JOIN locations ON clients.primary_location_id = locations.id
  `;

	// --- 2. FILTERS ---
	const whereClauses: string[] = [];

	if (trialEligible === 'true') {
		whereClauses.push(`
    NOT EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.client_id = clients.id
        AND COALESCE(b.try_out, false) = false
        AND b.status NOT IN ('Cancelled','CancelledLate') -- adjust if needed
        AND b.start_time >= $${paramIndex}::timestamptz

    )
  `);
		params.push(trialSinceIso);
		paramIndex++;
	} else if (trialEligible === 'false') {
		whereClauses.push(`
    EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.client_id = clients.id
        AND COALESCE(b.try_out, false) = false
        AND b.status NOT IN ('Cancelled','CancelledLate')
        AND b.start_time >= $${paramIndex}::timestamptz

    )
  `);
		params.push(trialSinceIso);
		paramIndex++;
	}

	// Available clients not linked to any customer
	if (available) {
		whereClauses.push(`
      clients.id NOT IN (
        SELECT client_id FROM client_customer_relationships
      )
    `);
	} else if (customerId) {
		sql += ` INNER JOIN client_customer_relationships rel ON rel.client_id = clients.id `;
		whereClauses.push(`rel.customer_id = $${paramIndex++}`);
		params.push(customerId);
	}

	// Active/inactive filter
	if (active === 'true') {
		whereClauses.push(`clients.active = true`);
	} else if (active === 'false') {
		whereClauses.push(`clients.active = false`);
	}

	// Trainer ID filter
	if (trainerId) {
		whereClauses.push(`clients.primary_trainer_id = $${paramIndex++}`);
		params.push(parseInt(trainerId, 10));
	}

	// Search filter
	if (search) {
		const searchTerms = search.split(/\s+/).filter(Boolean);
		const termClauses = searchTerms.map((term) => {
			const startIndex = paramIndex;
			params.push(`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`);
			paramIndex += 4;
			return `
        (
          clients.firstname ILIKE $${startIndex} OR
          clients.lastname ILIKE $${startIndex + 1} OR
          clients.email ILIKE $${startIndex + 2} OR
          clients.phone ILIKE $${startIndex + 3}
        )
      `;
		});

		if (termClauses.length > 0) {
			whereClauses.push(`(${termClauses.join(' AND ')})`);
		}
	}

	// Remove clients with empty names
	whereClauses.push(`
    (TRIM(COALESCE(clients.firstname, '')) <> '' OR TRIM(COALESCE(clients.lastname, '')) <> '')
  `);

	if (whereClauses.length > 0) {
		sql += ` WHERE ${whereClauses.join(' AND ')}`;
	}

	// --- 3. ORDER + PAGINATION ---

	let orderClause = `clients.lastname ${sortOrder}, clients.firstname ${sortOrder}`;
	if (sortBy === 'email') {
		orderClause = `clients.email ${sortOrder}`;
	} else if (sortBy === 'trainer') {
		orderClause = `users.lastname ${sortOrder}, users.firstname ${sortOrder}, clients.lastname ${sortOrder}, clients.firstname ${sortOrder}`;
	}

	sql += ` ORDER BY ${orderClause}`;

	if (limit > 0) {
		sql += ` LIMIT $${paramIndex++}`;
		params.push(limit);

		if (offset > 0) {
			sql += ` OFFSET $${paramIndex++}`;
			params.push(offset);
		}
	}

	try {
		const ifModifiedSince = request.headers.get('if-modified-since');
		if (ifModifiedSince) {
			const [row] = await query<{ last_updated: string | null }>(
				`SELECT MAX(updated_at) AS last_updated FROM clients`
			);
			const latestMs = parseTimestamp(row?.last_updated);
			const since = Date.parse(ifModifiedSince);
			if (Number.isFinite(latestMs) && Number.isFinite(since) && since >= latestMs) {
				const headers: Record<string, string> = { 'Content-Type': 'application/json' };
				headers['Last-Modified'] = new Date(Math.floor(latestMs / 1000) * 1000).toUTCString();
				return new Response(null, { status: 304, headers });
			}
		}

		const result = await query(sql, params);

		let maxUpdatedMs = result
			.map((row) => row?.updated_at || row?.created_at || row?.updatedAt || row?.createdAt)
			.map((ts) => parseTimestamp(ts))
			.filter((n): n is number => Number.isFinite(n))
			.sort((a, b) => b - a)[0];

		if (!Number.isFinite(maxUpdatedMs)) {
			const [row] = await query<{ last_updated: string | null }>(
				`SELECT MAX(updated_at) AS last_updated FROM clients`
			);
			maxUpdatedMs = parseTimestamp(row?.last_updated) ?? 0;
		}

		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		const roundedMs = Number.isFinite(maxUpdatedMs) ? Math.floor(maxUpdatedMs / 1000) * 1000 : 0;
		headers['Last-Modified'] = new Date(roundedMs).toUTCString();

		if (ifModifiedSince) {
			const since = Date.parse(ifModifiedSince);
			if (Number.isFinite(since) && since >= roundedMs) {
				return new Response(null, { status: 304, headers });
			}
		}

		return new Response(JSON.stringify(result), { status: 200, headers });
	} catch (error) {
		console.error('Error fetching clients:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
