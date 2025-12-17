export async function fetchNotes(
	targetId: number,
	targetType: 'User' | 'Client',
	fetchFn: typeof fetch
) {
	const normalize = (note: any) => ({
		...note,
		note_kind: note.note_kind ?? {
			id: note.note_kind_id || null,
			title: note.note_kind_title || null
		}
	});

	try {
		const response = await fetchFn(`/api/notes?target_id=${targetId}&target_type=${targetType}`);
		if (!response.ok) throw new Error('Failed to fetch notes');

		const rawNotes = await response.json();

		// ✅ Map raw notes to structured format
		return rawNotes.map((note) => normalize(note));
	} catch (error) {
		console.error('Error fetching notes:', error);
		return [];
	}
}

export async function addNote(
	targetId: number,
	targetType: 'User' | 'Client',
	writerId: number,
	text: string,
	fetchFn: typeof fetch,
	noteKindId?: number
) {
	const normalize = (note: any) => ({
		...note,
		note_kind: note.note_kind ?? {
			id: note.note_kind_id || null,
			title: note.note_kind_title || null
		}
	});

	try {
		const response = await fetchFn('/api/notes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				target_id: targetId,
				target_type: targetType,
				writer_id: writerId,
				text,
				note_kind_id: noteKindId || null
			})
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(`Failed to add note: ${result.error || response.status}`);
		}

		return normalize(result);
	} catch (error) {
		console.error('Error adding note:', error);
		return null;
	}
}

export async function updateNote(
	noteId: number,
	text: string,
	fetchFn: typeof fetch,
	noteKindId?: number | null
) {
	const normalize = (note: any) => ({
		...note,
		note_kind: note.note_kind ?? {
			id: note.note_kind_id || null,
			title: note.note_kind_title || null
		}
	});

	try {
		const response = await fetchFn('/api/notes', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: noteId,
				text,
				note_kind_id: noteKindId ?? null
			})
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(`Failed to update note: ${result.error || response.status}`);
		}

		return normalize(result);
	} catch (error) {
		console.error('Error updating note:', error);
		return null;
	}
}
