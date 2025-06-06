import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

export async function POST({ request }) {
	const body = await request.json();
	console.log('📥 Incoming absence POST body:', body);

	const { userId, description } = body;

	if (!userId) {
		console.warn('⚠️ Missing userId in request body');
		return json({ error: 'Missing userId' }, { status: 400 });
	}

	try {
		const now = new Date().toISOString();

		const result = await query(
			`INSERT INTO absences (user_id, added_by_id, start_time, description, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'Open', NOW(), NOW())
             RETURNING *`,
			[userId, userId, now, description || null]
		);

		console.log('✅ Absence saved:', result[0]);

		return json({ success: true, absence: result[0] });
	} catch (err) {
		console.error('❌ Failed to save absence:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

export async function DELETE({ url }) {
	const id = url.searchParams.get('id');
	if (!id) return json({ error: 'Missing id' }, { status: 400 });

	try {
		await query(`DELETE FROM absences WHERE id = $1`, [id]);
		return json({ success: true });
	} catch (err) {
		console.error('❌ Failed to delete absence:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

export async function PATCH({ request }) {
	const body = await request.json();
	const { absenceId, approverId, endTime, status } = body;

	if (!absenceId) {
		return json({ error: 'Missing absenceId' }, { status: 400 });
	}

	try {
		let updateFields = [];
		let values = [];
		let counter = 1;

		if (approverId) {
			updateFields.push(`approved_by_id = $${counter++}`);
			values.push(approverId);
		}

		if (endTime) {
			updateFields.push(`end_time = $${counter++}`);
			values.push(endTime);
		}

		if (status) {
			updateFields.push(`status = $${counter++}`);
			values.push(status);
		}

		if (updateFields.length === 0) {
			return json({ error: 'No fields to update' }, { status: 400 });
		}

		values.push(absenceId);

		const result = await query(
			`UPDATE absences
			 SET ${updateFields.join(', ')}
			 WHERE id = $${counter}
			 RETURNING *`,
			values
		);

		return json({ success: true, absence: result[0] });
	} catch (err) {
		console.error('❌ Failed to update absence:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
