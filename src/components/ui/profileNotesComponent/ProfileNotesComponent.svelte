<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchNotes, addNote } from '$lib/services/api/notesService';
	import Button from '../../bits/button/Button.svelte';
	import { user } from '$lib/stores/userStore';
	import QuillEditor from '../../bits/quillEditor/QuillEditor.svelte';
	import QuillViewer from '../../bits/quillViewer/QuillViewer.svelte';
	import { writable } from 'svelte/store';

	export let trainerId: number;
	let writerId: number = $user?.id;

	let notes = writable([]);
	let newNoteText = '';
	let isSubmitting = writable(false);

	// ✅ Fetch notes on mount
	onMount(async () => {
		const fetchedNotes = await fetchNotes(trainerId, 'User', fetch);
		notes.set(fetchedNotes);
	});

	// ✅ Handle content change from Quill
	function handleTextChange(event: CustomEvent<string>) {
		newNoteText = event.detail;
	}

	// ✅ Submit new note
	async function submitNote() {
		if (!newNoteText.trim()) return;

		isSubmitting.set(true);
		const newNote = await addNote(trainerId, 'User', writerId, newNoteText, fetch);

		if (newNote) {
			notes.update((existingNotes) => [newNote, ...existingNotes]); // ✅ Add new note first
			newNoteText = ''; // ✅ Clear input field
		}

		isSubmitting.set(false);
	}
</script>

<div class="flex h-full flex-col gap-4">
	<div>
		<QuillEditor content={newNoteText} on:change={handleTextChange} />
	</div>
	<div class="full-w flex flex-row justify-end">
		<Button
			text="Lägg till anteckning"
			variant="primary"
			on:click={submitNote}
			disabled={$isSubmitting}
		/>
	</div>

	<div class="w-full border-b border-gray-bright pb-2">
		<h3 class="text-xl">Anteckningar</h3>
	</div>

	<div class="flex h-[calc(100%-380px)] flex-col gap-4 overflow-y-auto pb-6 custom-scrollbar">
		{#each $notes as note (note.id)}
			<!-- ✅ Unique key ensures QuillViewer refreshes -->
			<div class="rounded-lg border border-gray-bright bg-white p-4 shadow-md">
				<div class="p-2">
					<QuillViewer content={note.text} key={note.id} />
				</div>

				<p class="text-xs text-gray-medium">{new Date(note.created_at).toLocaleString()}</p>
			</div>
		{:else}
			<p class="text-gray-200">Inga anteckningar ännu.</p>
		{/each}
	</div>
</div>

<style>
	/* ✅ Make notes list scrollable */
	/* No additional styles required at this moment */
</style>
