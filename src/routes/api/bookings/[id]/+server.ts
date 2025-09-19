import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';

function isMeetingKind(kind: string | null | undefined) {
	if (!kind) return false;
	const normalized = kind
		.toLowerCase()
		.replace('ö', 'o')
		.replace('ø', 'o')
		.replace('ó', 'o');
	return normalized.includes('meeting') || normalized.includes('mote');
}

export const DELETE: RequestHandler = async ({ params }) => {
	const idParam = params.id;
	const bookingId = Number(idParam);

	if (!bookingId || Number.isNaN(bookingId)) {
		return json({ error: 'Ogiltigt boknings-ID' }, { status: 400 });
	}

	try {
		const existing = await query(
			`SELECT b.id, bc.kind
			 FROM bookings b
			 LEFT JOIN booking_contents bc ON bc.id = b.booking_content_id
			 WHERE b.id = $1`,
			[bookingId]
		);

		if (!existing || existing.length === 0) {
			return json({ error: 'Bokningen kunde inte hittas' }, { status: 404 });
		}

		const record = existing[0];
		if (!isMeetingKind(record.kind)) {
			return json({ error: 'Endast mötesbokningar kan tas bort' }, { status: 400 });
		}

		await query(`DELETE FROM bookings WHERE id = $1`, [bookingId]);

		return json({ success: true });
	} catch (err) {
		console.error('🔥 Error deleting booking:', err);
		return json({ error: 'Kunde inte ta bort bokningen' }, { status: 500 });
	}
};
