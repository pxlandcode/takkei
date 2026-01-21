import { query } from '$lib/db';

function sanitizeString(value: unknown) {
	if (value === undefined || value === null) return '';
	if (typeof value !== 'string') return value;
	const trimmed = value.trim();
	return trimmed;
}

function isValidEmail(email: string | null) {
	if (!email) return false;
	return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export async function POST({ request }) {
	try {
		const body = await request.json();

		const payload = {
			name: sanitizeString(body?.name),
			email: sanitizeString(body?.email),
			phone: sanitizeString(body?.phone),
			invoice_address: sanitizeString(body?.invoice_address),
			invoice_zip: sanitizeString(body?.invoice_zip),
			invoice_city: sanitizeString(body?.invoice_city),
			organization_number: sanitizeString(body?.organization_number)
		};

		const clientIds = Array.isArray(body?.clientIds) ? body.clientIds : [];

		// Validation
		const errors: Record<string, string> = {};

		if (!payload.name) {
			errors.name = 'Namn krävs';
		}
		if (!payload.email) {
			errors.email = 'E-post krävs';
		} else if (!isValidEmail(payload.email as string | null)) {
			errors.email = 'Ogiltig e-postadress';
		}

		// Check if organization_number exists (if provided)
		if (payload.organization_number) {
			const existing = await query(
				`SELECT id FROM customers WHERE organization_number = $1 LIMIT 1`,
				[payload.organization_number]
			);

			if (existing.length > 0) {
				errors.organization_number = 'Organisationsnummer används redan';
			}
		}

		if (Object.keys(errors).length > 0) {
			return new Response(JSON.stringify({ success: false, errors }), { status: 400 });
		}

		// Insert customer
		const customerResult = await query(
			`INSERT INTO customers (
				name, email, phone, invoice_address, invoice_zip, invoice_city,
				organization_number, active, created_at, updated_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
			RETURNING id`,
			[
				payload.name,
				payload.email,
				payload.phone,
				payload.invoice_address,
				payload.invoice_zip,
				payload.invoice_city,
				payload.organization_number
			]
		);

		const customerId = customerResult[0]?.id;

		if (!customerId) {
			return new Response(JSON.stringify({ error: 'Kunde inte skapa kunden' }), { status: 500 });
		}

		// Link clients
		if (Array.isArray(clientIds) && clientIds.length > 0) {
			const inserts = clientIds.map((clientId) =>
				query(
					`INSERT INTO client_customer_relationships (
						customer_id, client_id, relationship, active, created_at, updated_at
					) VALUES ($1, $2, 'Training', true, NOW(), NOW())`,
					[customerId, clientId]
				)
			);
			await Promise.all(inserts);
		}

		return new Response(JSON.stringify({ success: true, customerId }), { status: 201 });
	} catch (err) {
		console.error('Create customer error:', err);
		return new Response(JSON.stringify({ error: 'Ett internt fel uppstod' }), { status: 500 });
	}
}
