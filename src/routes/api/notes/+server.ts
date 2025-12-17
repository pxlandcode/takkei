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
      SELECT
        notes.*,
        note_kinds.title AS note_kind_title,
        booking_notes.booking_id AS linked_booking_id
      FROM notes
      LEFT JOIN note_kinds ON notes.note_kind_id = note_kinds.id
      LEFT JOIN booking_notes ON booking_notes.note_id = notes.id
      WHERE notes.target_id = $1 AND notes.target_type = $2
      ORDER BY notes.created_at DESC
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
		const { target_id, target_type, writer_id, text, note_kind_id } = await request.json();

		if (!target_id || !target_type || !writer_id || !text) {
			return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
		}

		const result = await query(
			`
      INSERT INTO notes (target_id, target_type, writer_id, text, note_kind_id, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'new', NOW(), NOW())
      RETURNING *;
      `,
			[target_id, target_type, writer_id, text, note_kind_id || null]
		);

		return new Response(JSON.stringify(result[0]), { status: 201 });
	} catch (error) {
		console.error('Error adding note:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}

export async function PUT({ request }) {
	try {
		const { id, text, note_kind_id } = await request.json();

		if (!id || !text) {
			return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
		}

		const result = await query(
			`
      UPDATE notes
      SET text = $1,
          note_kind_id = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
			[text, note_kind_id || null, id]
		);

		if (result.length === 0) {
			return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 });
		}

		// hydrate note_kind_title and linked_booking_id to keep client state consistent
		const enriched = await query(
			`
        SELECT
          n.*,
          nk.title AS note_kind_title,
          bn.booking_id AS linked_booking_id
        FROM notes n
        LEFT JOIN note_kinds nk ON nk.id = n.note_kind_id
        LEFT JOIN booking_notes bn ON bn.note_id = n.id
        WHERE n.id = $1
      `,
			[id]
		);

		return new Response(JSON.stringify(enriched[0] ?? result[0]), { status: 200 });
	} catch (error) {
		console.error('Error updating note:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
