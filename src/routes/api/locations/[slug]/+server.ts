import { query } from '$lib/db';

export async function GET({ params }) {
	const id = params.slug;

	if (!id) {
		return new Response(JSON.stringify({ error: 'Missing location ID' }), { status: 400 });
	}

	try {
		const result = await query(`SELECT id, name, color FROM locations WHERE id = $1`, [id]);

		if (result.length === 0) {
			return new Response(JSON.stringify({ error: 'Location not found' }), { status: 404 });
		}

		return new Response(JSON.stringify(result[0]), { status: 200 });
	} catch (error) {
		console.error('Error fetching location:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}

export async function PATCH({ request, params }) {
	const id = params.slug;

	const { name, color } = await request.json();

	if (!id || (!name && !color)) {
		return new Response(JSON.stringify({ error: 'Invalid update request' }), { status: 400 });
	}

	try {
		await query(
			`UPDATE locations SET
			 name = COALESCE($1, name),
			 color = COALESCE($2, color),
			 updated_at = now()
			 WHERE id = $3`,
			[name, color, id]
		);

		return new Response(JSON.stringify({ success: true }), { status: 200 });
	} catch (error) {
		console.error('Error updating location:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
