type NoteKind = { id: number | null; title: string | null };

type Note = {
	id: number;
	text: string;
	created_at: string;
	writer_id: number;
	note_kind?: NoteKind | null;
	note_kind_id?: number | null;
	note_kind_title?: string | null;
	linked_booking_id?: number | null;
	[key: string]: unknown;
};

function normalizeNote(raw: Note): Note {
	const note_kind =
		raw.note_kind ??
		(raw.note_kind_id !== undefined || raw.note_kind_title !== undefined
			? {
					id: raw.note_kind_id ?? null,
					title: raw.note_kind_title ?? null
			  }
			: null);

	return {
		...raw,
		note_kind: note_kind ?? null
	};
}

export async function fetchBookingNotes(bookingId: number, fetchFn: typeof fetch): Promise<Note[]> {
	try {
		const response = await fetchFn(`/api/bookings/${bookingId}/notes`);
		if (!response.ok) throw new Error('Failed to fetch booking notes');
		const notes: Note[] = await response.json();
		return notes.map(normalizeNote);
	} catch (error) {
		console.error('Error fetching booking notes:', error);
		return [];
	}
}

export async function linkNoteToBooking(
	bookingId: number,
	noteId: number,
	fetchFn: typeof fetch
): Promise<Note | null> {
	try {
		const response = await fetchFn('/api/booking_notes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ booking_id: bookingId, note_id: noteId })
		});

		const result = await response.json();
		if (!response.ok) {
			throw new Error(result?.error || 'Failed to link note');
		}

		return normalizeNote(result as Note);
	} catch (error) {
		console.error('Error linking note to booking:', error);
		return null;
	}
}

export async function unlinkNoteFromBooking(noteId: number, fetchFn: typeof fetch): Promise<boolean> {
	try {
		const response = await fetchFn(`/api/booking_notes?note_id=${noteId}`, {
			method: 'DELETE'
		});
		if (!response.ok) {
			const result = await response.json();
			throw new Error(result?.error || 'Failed to unlink note');
		}
		return true;
	} catch (error) {
		console.error('Error unlinking note from booking:', error);
		return false;
	}
}
