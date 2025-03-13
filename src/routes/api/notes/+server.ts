import { query } from '$lib/db';

export async function GET({ url }) {
	const targetId = url.searchParams.get('target_id');
	const targetType = url.searchParams.get('target_type'); // "User" or "Client"

	if (!targetId || !targetType) {
		return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
	}

	try {
		const result = await query(
			`
            SELECT * FROM notes 
            WHERE target_id = $1 AND target_type = $2 
            ORDER BY created_at DESC
            `,
			[targetId, targetType]
		);
		return new Response(JSON.stringify(result), { status: 200 });
	} catch (error) {
		console.error('Error fetching notes:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}

export async function POST({ request }) {
	try {
		const { target_id, target_type, writer_id, text } = await request.json();

		if (!target_id || !target_type || !writer_id || !text) {
			return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
		}

		const result = await query(
			`
            INSERT INTO notes (target_id, target_type, writer_id, text, status, created_at, updated_at) 
            VALUES ($1, $2, $3, $4, 'new', NOW(), NOW()) 
            RETURNING *;
            `,
			[target_id, target_type, writer_id, text]
		);

		return new Response(JSON.stringify(result[0]), { status: 201 });
	} catch (error) {
		console.error('Error adding note:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
