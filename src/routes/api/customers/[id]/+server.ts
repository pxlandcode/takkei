// /api/customers/[id]/+server.ts (list view payload)
import { query } from '$lib/db';

export async function GET({ params }) {
	const id = params.id;

	// customer
	const [customer] = await query(
		`SELECT id, name, email, phone, customer_no, organization_number,
            invoice_address, invoice_zip, invoice_city, invoice_reference, active
     FROM customers WHERE id = $1`,
		[id]
	);
	if (!customer)
		return new Response(JSON.stringify({ error: 'Customer not found' }), { status: 404 });

	// clients (optional for sidebar/things)
	const clients = await query(
		`SELECT cl.id, cl.firstname, cl.lastname
     FROM client_customer_relationships r
     JOIN clients cl ON cl.id = r.client_id
     WHERE r.customer_id = $1 AND r.active = TRUE`,
		[id]
	);

	// packages summary
	const rawPackages = await query(
		`SELECT
       p.id, p.customer_id, p.client_id, p.autogiro, p.frozen_from_date,
       p.invoice_numbers, p.article_id,
       a.name  AS article_name,
       a.sessions AS article_sessions,
       cl.firstname AS client_firstname, cl.lastname AS client_lastname
     FROM packages p
     LEFT JOIN articles a ON a.id = p.article_id
     LEFT JOIN clients  cl ON cl.id = p.client_id
     WHERE p.customer_id = $1
     ORDER BY p.id ASC`,
		[id]
	);

	// chargeable bookings used up to now per package
	const ids = rawPackages.map((p: any) => p.id);
	let bookingCounts: Record<number, { total: number; usedUntilNow: number }> = {};
	if (ids.length) {
		const rows = await query(
			`SELECT
			    package_id,
			    COUNT(*)::int AS total_cnt,
			    SUM(CASE WHEN start_time < NOW() THEN 1 ELSE 0 END)::int AS used_until_now
			  FROM bookings
			  WHERE package_id = ANY($1::int[])
			    AND (status IS NULL OR LOWER(status) <> 'cancelled')
			  GROUP BY package_id`,
			[ids]
		);
		bookingCounts = rows.reduce(
			(acc: Record<number, { total: number; usedUntilNow: number }>, row: any) => {
				acc[row.package_id] = {
					total: row.total_cnt ?? 0,
					usedUntilNow: row.used_until_now ?? 0
				};
				return acc;
			},
			{}
		);
	}

	const packages = rawPackages.map((p: any) => {
		const hasSessions = p.article_sessions !== null && p.article_sessions !== undefined;
		const sessions = hasSessions ? Number(p.article_sessions) : null;
		const counts = bookingCounts[p.id] ?? { total: 0, usedUntilNow: 0 };
		const usedTotal = counts.total ?? 0;
		const usedUntilNow = counts.usedUntilNow ?? 0;
		const remaining = sessions != null ? Math.max(0, sessions - usedTotal) : null;
		const remainingToday = sessions != null ? Math.max(0, sessions - usedUntilNow) : null;

		return {
			id: p.id,
			article: { id: p.article_id, name: p.article_name },
			client: p.client_id
				? {
						id: p.client_id,
						firstname: p.client_firstname,
						lastname: p.client_lastname
					}
				: null,
			autogiro: !!p.autogiro,
			frozen_from_date: p.frozen_from_date,
			invoice_numbers: p.invoice_numbers || [],
			remaining_sessions: remaining, // <-- Saldo in the old UI
			remaining_sessions_today: remainingToday,
			used_sessions_total: usedTotal,
			used_sessions_until_now: usedUntilNow,
			total_sessions: sessions
		};
	});

	return new Response(JSON.stringify({ ...customer, clients, packages }), { status: 200 });
}

function sanitizeString(value: unknown) {
	if (value === undefined || value === null) return null;
	if (typeof value !== 'string') return value;
	const trimmed = value.trim();
	return trimmed === '' ? null : trimmed;
}

function isValidEmail(email: string | null) {
	if (!email) return true;
	return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export async function PATCH({ params, request }) {
	const customerId = Number(params.id);

	if (!Number.isFinite(customerId) || customerId <= 0) {
		return new Response(JSON.stringify({ error: 'Ogiltigt kund-id' }), { status: 400 });
	}

	let body: any;
	try {
		body = await request.json();
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Ogiltig kropp' }), { status: 400 });
	}

	const payload = {
		name: sanitizeString(body?.name),
		email: sanitizeString(body?.email),
		phone: sanitizeString(body?.phone),
		customer_no: sanitizeString(body?.customer_no),
		organization_number: sanitizeString(body?.organization_number),
		invoice_address: sanitizeString(body?.invoice_address),
		invoice_zip: sanitizeString(body?.invoice_zip),
		invoice_city: sanitizeString(body?.invoice_city),
		invoice_reference: sanitizeString(body?.invoice_reference),
		active: body?.active === undefined ? null : !!body.active
	};

	const errors: Record<string, string> = {};
	if (!payload.name) errors.name = 'Namn krävs';
	if (!isValidEmail(payload.email as string | null)) errors.email = 'Ogiltig e-postadress';

	if (payload.organization_number) {
		const existing = await query(
			`SELECT id FROM customers WHERE organization_number = $1 AND id <> $2 LIMIT 1`,
			[payload.organization_number, customerId]
		);
		if (existing.length > 0) {
			errors.organization_number = 'Organisationsnummer används redan';
		}
	}

	if (Object.keys(errors).length > 0) {
		return new Response(JSON.stringify({ errors }), { status: 400 });
	}

	let updated;
	try {
		const rows = await query(
			`UPDATE customers
         SET name = $1,
             email = $2,
             phone = $3,
             customer_no = $4,
             organization_number = $5,
             invoice_address = $6,
             invoice_zip = $7,
             invoice_city = $8,
             invoice_reference = $9,
             active = COALESCE($10::boolean, active),
             updated_at = NOW()
         WHERE id = $11
         RETURNING id, name, email, phone, customer_no, organization_number,
                   invoice_address, invoice_zip, invoice_city, invoice_reference, active`,
			[
				payload.name,
				payload.email,
				payload.phone,
				payload.customer_no,
				payload.organization_number,
				payload.invoice_address,
				payload.invoice_zip,
				payload.invoice_city,
				payload.invoice_reference,
				payload.active,
				customerId
			]
		);
		updated = rows[0];
	} catch (error) {
		console.error('Error updating customer:', error);
		return new Response(JSON.stringify({ error: 'Kunde inte uppdatera kund' }), { status: 500 });
	}

	if (!updated) {
		return new Response(JSON.stringify({ error: 'Kund hittades inte' }), { status: 404 });
	}

	return new Response(JSON.stringify(updated), { status: 200 });
}
