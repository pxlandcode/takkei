import { query } from '$lib/db';

interface RelationshipRow {
	id: number;
	client_id: number;
	active: boolean;
}

function parseClientIds(payload: unknown): number[] | null {
	if (!Array.isArray(payload)) return null;

	const seen = new Set<number>();
	for (const value of payload) {
		const id = Number(value);
		if (!Number.isFinite(id)) continue;
		if (id <= 0) continue;
		seen.add(id);
	}

	return Array.from(seen);
}

export async function PATCH({ params, request }) {
	const customerId = Number(params.id);

	if (!Number.isFinite(customerId) || customerId <= 0) {
		return new Response(JSON.stringify({ error: 'Ogiltigt kund-id' }), { status: 400 });
	}

	let body: { clientIds?: unknown };
	try {
		body = await request.json();
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Ogiltig kropp' }), { status: 400 });
	}

	const clientIds = parseClientIds(body?.clientIds);
	if (clientIds === null) {
		return new Response(JSON.stringify({ error: "clientIds måste vara en lista" }), { status: 400 });
	}

	// Ensure customer exists
	const existingCustomer = await query('SELECT 1 FROM customers WHERE id = $1 LIMIT 1', [customerId]);
	if (existingCustomer.length === 0) {
		return new Response(JSON.stringify({ error: 'Kund hittades inte' }), { status: 404 });
	}

	// Fetch existing relationships (active + inactive)
	const relationships = (await query(
		`SELECT id, client_id, active
		 FROM client_customer_relationships
		 WHERE customer_id = $1`,
		[customerId]
	)) as RelationshipRow[];

	const relationshipsByClient = new Map<number, RelationshipRow>();
	for (const rel of relationships) {
		relationshipsByClient.set(rel.client_id, rel);
	}

	const currentlyActiveIds = new Set<number>(
		relationships
			.filter((rel) => rel.active)
			.map((rel) => rel.client_id)
	);

	const targetClientIds = new Set<number>(clientIds);
	const toDeactivate: number[] = [];
	for (const activeId of currentlyActiveIds) {
		if (!targetClientIds.has(activeId)) {
			toDeactivate.push(activeId);
		}
	}

	const toActivate: number[] = [];
	const toInsert: number[] = [];
	for (const clientId of targetClientIds) {
		const rel = relationshipsByClient.get(clientId);
		if (rel) {
			if (!rel.active) {
				toActivate.push(clientId);
			}
		} else {
			toInsert.push(clientId);
		}
	}

	try {
		if (toDeactivate.length > 0) {
			await query(
				`UPDATE client_customer_relationships
				 SET active = FALSE, updated_at = NOW()
				 WHERE customer_id = $1 AND active = TRUE AND client_id = ANY($2::int[])`,
				[customerId, toDeactivate]
			);
		}

		if (toActivate.length > 0) {
			await query(
				`UPDATE client_customer_relationships
				 SET active = TRUE, relationship = COALESCE(relationship, 'Training'), updated_at = NOW()
				 WHERE customer_id = $1 AND client_id = ANY($2::int[])`,
				[customerId, toActivate]
			);
		}

		if (toInsert.length > 0) {
			await query(
				`INSERT INTO client_customer_relationships (
					customer_id, client_id, relationship, active, created_at, updated_at
				)
				SELECT $1, UNNEST($2::int[]), 'Training', TRUE, NOW(), NOW()`,
				[customerId, toInsert]
			);
		}
	} catch (error) {
		console.error('Failed to update client relationships', error);
		return new Response(JSON.stringify({ error: 'Misslyckades att uppdatera kopplingar' }), { status: 500 });
	}

	const updatedClients = await query(
		`SELECT cl.id, cl.firstname, cl.lastname
		 FROM client_customer_relationships rel
		 JOIN clients cl ON cl.id = rel.client_id
		 WHERE rel.customer_id = $1 AND rel.active = TRUE
		 ORDER BY cl.lastname NULLS LAST, cl.firstname NULLS LAST`,
		[customerId]
	);

	return new Response(JSON.stringify({ success: true, clients: updatedClients }), {
		status: 200
	});
}
