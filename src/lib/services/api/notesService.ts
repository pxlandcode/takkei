export async function fetchNotes(
	targetId: number,
	targetType: 'User' | 'Client',
	fetchFn: typeof fetch
) {
	try {
		const response = await fetchFn(`/api/notes?target_id=${targetId}&target_type=${targetType}`);
		if (!response.ok) throw new Error('Failed to fetch notes');
		return await response.json();
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
	fetchFn: typeof fetch
) {
	// ✅ Log request payload
	console.log('🚀 Sending Note:', {
		target_id: targetId,
		target_type: targetType,
		writer_id: writerId,
		text
	});

	try {
		const response = await fetchFn('/api/notes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				target_id: targetId,
				target_type: targetType,
				writer_id: writerId,
				text
			})
		});

		// ✅ Log server response
		const result = await response.json();
		console.log('📥 Server Response:', result);

		if (!response.ok) {
			throw new Error(`Failed to add note: ${result.error || response.status}`);
		}

		return result;
	} catch (error) {
		console.error('Error adding note:', error);
		return null;
	}
}
