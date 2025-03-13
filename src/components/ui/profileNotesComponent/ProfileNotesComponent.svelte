<script lang="ts">
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { fetchNotes, addNote } from '$lib/services/api/notesService';
	import Button from '../../bits/button/Button.svelte';
	import { user } from '$lib/stores/userStore';

	export let trainerId: number;
	let writerId: number = $user?.id;

	let notes = writable([]);
	let isSubmitting = writable(false);

	let editor: HTMLDivElement | null = null;

	// ✅ Fetch notes on mount
	onMount(async () => {
		const fetchedNotes = await fetchNotes(trainerId, 'User', fetch);
		notes.set(fetchedNotes);
	});

	// ✅ Apply formatting using Range API
	function applyFormatting(tag: string) {
		if (!editor) return;
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;

		const range = selection.getRangeAt(0);
		const selectedText = range.extractContents();

		const wrapper = document.createElement(tag);
		wrapper.appendChild(selectedText);
		range.insertNode(wrapper);

		// Move the cursor after the inserted tag
		range.setStartAfter(wrapper);
		range.setEndAfter(wrapper);
		selection.removeAllRanges();
		selection.addRange(range);
	}

	// ✅ Insert ordered/unordered list
	function insertList(type: 'ul' | 'ol') {
		if (!editor) return;
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;

		const range = selection.getRangeAt(0);
		const list = document.createElement(type);
		const listItem = document.createElement('li');

		listItem.innerHTML = 'Skriv här...';
		list.appendChild(listItem);
		range.insertNode(list);

		// Move cursor inside the list item
		range.setStart(listItem, 0);
		range.setEnd(listItem, 0);
		selection.removeAllRanges();
		selection.addRange(range);
	}

	// ✅ Insert a link
	function insertLink() {
		if (!editor) return;
		const url = prompt('Ange URL:');
		if (!url) return;

		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;

		const range = selection.getRangeAt(0);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.target = '_blank';
		anchor.innerText = selection.toString() || url;

		range.deleteContents();
		range.insertNode(anchor);
	}

	// ✅ Submit new note
	async function submitNote() {
		if (!editor) return;

		const newNoteText = editor.innerHTML.trim();
		if (!newNoteText) return;

		isSubmitting.set(true);

		const newNote = await addNote(trainerId, 'User', writerId, newNoteText, fetch);

		if (newNote) {
			notes.update((existingNotes) => [newNote, ...existingNotes]);
			editor.innerHTML = ''; // Clear editor after submission
		}

		isSubmitting.set(false);
	}
</script>

<div class="flex flex-col gap-4">
	<!-- 🔹 Toolbar -->
	<div class="flex gap-2 rounded-md border bg-gray-100 p-2">
		<button class="editor-btn" on:click={() => applyFormatting('b')}>B</button>
		<button class="editor-btn" on:click={() => applyFormatting('i')}>I</button>
		<button class="editor-btn" on:click={() => applyFormatting('s')}>S</button>
		<button class="editor-btn" on:click={() => insertList('ol')}>1.</button>
		<button class="editor-btn" on:click={() => insertList('ul')}>•</button>
		<button class="editor-btn" on:click={insertLink}>🔗</button>
	</div>

	<!-- 🔹 Rich Text Editor -->
	<div
		bind:this={editor}
		class="editor min-h-[100px] rounded-md border bg-white p-3"
		contenteditable="true"
	></div>

	<Button
		text="Lägg till anteckning"
		variant="primary"
		class="mt-2"
		on:click={submitNote}
		disabled={$isSubmitting}
	/>

	<!-- 🔹 Notes List -->
	<div class="space-y-4">
		{#each $notes as note}
			<div class="note-container">
				<p class="note-text">{@html note.text}</p>
				<p class="note-date">{new Date(note.created_at).toLocaleString()}</p>
			</div>
		{:else}
			<p class="text-gray-500">Inga anteckningar ännu.</p>
		{/each}
	</div>
</div>

<style>
	/* 🔹 General Styles */
	.editor {
		outline: none;
		cursor: text;
		min-height: 100px;
	}

	.editor-btn {
		padding: 5px 10px;
		border-radius: 5px;
		background: white;
		border: 1px solid gray;
		cursor: pointer;
		font-weight: bold;
	}

	.editor-btn:hover {
		background: lightgray;
	}

	/* 🔹 Notes List Styles */
	.note-container {
		background: white;
		padding: 12px;
		border-radius: 8px;
		border: 1px solid #ddd;
		box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.1);
	}

	.note-text {
		font-size: 14px;
		color: #333;
	}

	.note-date {
		font-size: 12px;
		color: #777;
		margin-top: 4px;
	}

	/* 🔹 List Styles (Explicitly for normalize.css) */
	.editor ul,
	.editor ol,
	.note-container ul,
	.note-container ol {
		padding-left: 20px;
		margin-top: 6px;
		margin-bottom: 6px;
	}

	.editor ul {
		list-style-type: disc; /* Regular bullet points */
	}

	.editor ol {
		list-style-type: decimal; /* Numbered lists */
	}

	.note-container ul {
		list-style-type: disc;
	}

	.note-container ol {
		list-style-type: decimal;
	}

	.note-container li {
		margin-bottom: 4px;
	}

	/* 🔹 Link Styling */
	.editor a,
	.note-container a {
		color: #007bff;
		text-decoration: underline;
		font-weight: 500;
		cursor: pointer;
	}

	.editor a:hover,
	.note-container a:hover {
		color: #0056b3;
		text-decoration: none;
	}
</style>
