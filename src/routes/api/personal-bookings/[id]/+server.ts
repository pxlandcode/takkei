import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';

export const DELETE: RequestHandler = async ({ params }) => {
	const idParam = params.id;
	const bookingId = Number(idParam);

	if (!bookingId || Number.isNaN(bookingId)) {
		return json({ error: 'Ogiltigt boknings-ID' }, { status: 400 });
	}

	try {
		const existing = await query(
			`SELECT id FROM personal_bookings WHERE id = $1`,
			[bookingId]
		);

		if (!existing || existing.length === 0) {
			return json({ error: 'Bokningen kunde inte hittas' }, { status: 404 });
		}

		await query(`DELETE FROM personal_bookings WHERE id = $1`, [bookingId]);

		return json({ success: true });
	} catch (err) {
		console.error('🔥 Error deleting personal booking:', err);
		return json({ error: 'Kunde inte ta bort bokningen' }, { status: 500 });
	}
};
