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

function resolveActorUserId(authUser: App.Locals['user'] | null): number | null {
	if (!authUser) return null;
	if (authUser.kind === 'trainer') {
		return typeof authUser.trainerId === 'number' ? authUser.trainerId : null;
	}
	if (authUser.kind === 'client') {
		return typeof authUser.clientId === 'number' ? authUser.clientId : null;
	}
	return null;
}

export const GET: RequestHandler = async ({ params }) => {
	const bookingId = Number(params.id);

	if (!bookingId || Number.isNaN(bookingId)) {
		return json({ error: 'Ogiltigt boknings-ID' }, { status: 400 });
	}

	try {
		const result = await query(
			`
      SELECT bookings.*, 
             COALESCE(bn.notes_count, 0) AS linked_note_count,
             rooms.name AS room_name, 
             locations.name AS location_name,
             locations.color AS location_color,
             users.firstname AS trainer_firstname,
             users.lastname AS trainer_lastname,
             clients.firstname AS client_firstname,
             clients.lastname AS client_lastname,
             clients.active AS client_active,
             booking_contents.id AS booking_content_id,
             booking_contents.kind AS booking_content_kind,
             trainee.id AS trainee_id,
             trainee.firstname AS trainee_firstname,
             trainee.lastname AS trainee_lastname,
             trainee.active AS trainee_active
      FROM bookings
      LEFT JOIN (
        SELECT booking_id, COUNT(*) AS notes_count
        FROM booking_notes
        GROUP BY booking_id
      ) bn ON bn.booking_id = bookings.id
      LEFT JOIN rooms ON bookings.room_id = rooms.id
      LEFT JOIN locations ON bookings.location_id = locations.id
      LEFT JOIN users ON bookings.trainer_id = users.id
      LEFT JOIN clients ON bookings.client_id = clients.id
      LEFT JOIN users AS trainee ON bookings.user_id = trainee.id
      LEFT JOIN booking_contents ON bookings.booking_content_id = booking_contents.id
      WHERE bookings.id = $1
      `,
			[bookingId]
		);

		if (!result || result.length === 0) {
			return json({ error: 'Bokningen hittades inte' }, { status: 404 });
		}

		return json(result[0]);
	} catch (error) {
		console.error('Error fetching booking by id:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const idParam = params.id;
	const bookingId = Number(idParam);

	if (!bookingId || Number.isNaN(bookingId)) {
		return json({ error: 'Ogiltigt boknings-ID' }, { status: 400 });
	}

	const actorUserId = resolveActorUserId(locals.user ?? null);
	if (!actorUserId || Number.isNaN(actorUserId)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const existing = await query(
			`SELECT b.id, b.created_by_id, bc.kind
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
		if (
			record.created_by_id !== null &&
			record.created_by_id !== undefined &&
			Number(record.created_by_id) !== actorUserId
		) {
			return json(
				{ error: 'Endast mötesägaren kan avboka mötet för alla deltagare.' },
				{ status: 403 }
			);
		}

		await query(`DELETE FROM bookings WHERE id = $1`, [bookingId]);

		return json({ success: true });
	} catch (err) {
		console.error('🔥 Error deleting booking:', err);
		return json({ error: 'Kunde inte ta bort bokningen' }, { status: 500 });
	}
};
