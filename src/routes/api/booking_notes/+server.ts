import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const bookingId = Number(body?.booking_id);
		const noteId = Number(body?.note_id);

		if (!bookingId || Number.isNaN(bookingId) || !noteId || Number.isNaN(noteId)) {
			return json({ error: 'booking_id och note_id krävs' }, { status: 400 });
		}

		const bookings = await query(`SELECT id, client_id FROM bookings WHERE id = $1`, [bookingId]);
		const booking = bookings[0];
		if (!booking) {
			return json({ error: 'Bokningen hittades inte' }, { status: 404 });
		}

		if (!booking.client_id) {
			return json({ error: 'Bokningen saknar kund – anteckning kan inte kopplas' }, { status: 400 });
		}

		const notes = await query(
			`
        SELECT n.*, nk.title AS note_kind_title
        FROM notes n
        LEFT JOIN note_kinds nk ON nk.id = n.note_kind_id
        WHERE n.id = $1
      `,
			[noteId]
		);
		const note = notes[0];
		if (!note) {
			return json({ error: 'Anteckningen hittades inte' }, { status: 404 });
		}

		if (note.target_type !== 'Client') {
			return json({ error: 'Endast klient-anteckningar kan kopplas till en bokning' }, { status: 400 });
		}

		if (Number(note.target_id) !== Number(booking.client_id)) {
			return json(
				{ error: 'Anteckningen tillhör en annan klient än bokningen' },
				{ status: 400 }
			);
		}

		const existing = await query(`SELECT booking_id FROM booking_notes WHERE note_id = $1`, [noteId]);
		if (existing.length > 0) {
			return json(
				{
					error: 'Anteckningen är redan kopplad till en bokning',
					booking_id: existing[0].booking_id
				},
				{ status: 400 }
			);
		}

		await query(
			`
        INSERT INTO booking_notes (booking_id, note_id, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
      `,
			[bookingId, noteId]
		);

		const responseNote = {
			...note,
			linked_booking_id: bookingId,
			note_kind: note.note_kind ?? {
				id: note.note_kind_id ?? null,
				title: note.note_kind_title ?? null
			}
		};

		return json(responseNote, { status: 201 });
	} catch (error) {
		console.error('Error linking note to booking:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url }) => {
	try {
		const noteId = Number(url.searchParams.get('note_id'));
		if (!noteId) {
			return json({ error: 'note_id krävs' }, { status: 400 });
		}

		await query(`DELETE FROM booking_notes WHERE note_id = $1`, [noteId]);
		return json({ success: true });
	} catch (error) {
		console.error('Error unlinking note from booking:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
