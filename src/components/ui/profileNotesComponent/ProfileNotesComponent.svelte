<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchNotes, addNote } from '$lib/services/api/notesService';
	import { writable } from 'svelte/store';
	import Button from '../../bits/button/Button.svelte';
	import { user } from '$lib/stores/userStore';
	import QuillEditor from '../../bits/quillEditor/QuillEditor.svelte';
	import QuillViewer from '../../bits/quillViewer/QuillViewer.svelte';
	import OptionButton from '../../bits/optionButton/OptionButton.svelte';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';

	export let targetId: number | null = null;
	export let isClient: boolean = false;

	let writerId: number = $user?.id;
	let targetType = isClient ? 'Client' : 'User';

	let allNotes = writable([]);
	let notes = writable([]);
	let newNoteText = '';
	let isSubmitting = writable(false);
	let noteKinds = writable([]);
	let selectedKind = writable({ value: 'all', label: 'Alla anteckningar' });
	let selectedNoteKindForNewNote = null;
	let noteKindId = null;

	const noteKindIcons = {
		1: 'BasicInfo',
		2: 'HandoverInfo',
		3: 'CircleInfo',
		default: 'Notes'
	};

	$: noteKindId = selectedNoteKindForNewNote;

	// 🧠 Load on mount
	onMount(async () => {
		if (!targetId || !targetType) return;

		const [fetchedNotes, fetchedKinds] = await Promise.all([
			fetchNotes(targetId, targetType, fetch),
			fetch('/api/note_kinds').then((res) => res.json())
		]);

		allNotes.set(fetchedNotes);
		noteKinds.set(fetchedKinds);

		filterNotes(); // Initial filter
	});

	$: filterNotes();

	function filterNotes() {
		const all = $allNotes;
		const kind = $selectedKind.value;

		if (kind === 'all') {
			notes.set(all);
		} else {
			notes.set(all.filter((n) => n.note_kind?.id == kind));
		}
	}

	function setSelectedKind(kind) {
		selectedKind.set(kind);
		filterNotes();
	}

	function handleTextChange(event: CustomEvent<string>) {
		newNoteText = event.detail;
	}

	async function submitNote() {
		if (!newNoteText.trim() || !targetId || !targetType) return;
		isSubmitting.set(true);

		const newNote = await addNote(targetId, targetType, writerId, newNoteText, fetch, noteKindId);
		if (newNote) {
			allNotes.update((existing) => [newNote, ...existing]);
			newNoteText = '';
			selectedNoteKindForNewNote = null;
			filterNotes();
		}

		isSubmitting.set(false);
	}
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto custom-scrollbar">
	<div class="">
		<QuillEditor content={newNoteText} on:change={handleTextChange} />
	</div>

	{#if isClient}
		<div class="full-w flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
			<div class="flex w-40 max-w-40">
				<Dropdown
					id="noteKind"
					label="Anteckningstyp"
					placeholder="Anteckning"
					options={[
						{ label: 'Anteckning', value: null },
						...$noteKinds.map((k) => ({
							label: k.title,
							value: k.id
						}))
					]}
					bind:selectedValue={selectedNoteKindForNewNote}
				/>
			</div>

			<div class="pt-8">
				{#if noteKindId == 1}
					<Button
						text="Lägg till anteckning"
						variant="primary"
						confirmOptions={{
							title: 'Är du säker?',
							description:
								'När du lägger till ny Grundinformation byter den ut informationen på klientens profilsida. Den gamla informationen finns såklart fortfarande kvar bland anteckningar.',
							action: submitNote
						}}
						disabled={$isSubmitting}
					/>
				{:else}
					<Button
						text="Lägg till anteckning"
						variant="primary"
						on:click={submitNote}
						disabled={$isSubmitting}
					/>
				{/if}
			</div>
		</div>
	{:else}
		<div class="full-w flex justify-end">
			<Button
				text="Lägg till anteckning"
				variant="primary"
				on:click={submitNote}
				disabled={$isSubmitting}
			/>
		</div>
	{/if}

	<div class="flex w-full flex-row items-center justify-between border-b border-gray-bright pb-2">
		<h3 class="text-xl">Anteckningar</h3>

		<!-- Filter menu for note kinds -->
	</div>
	{#if isClient && $noteKinds.length > 0}
		<!-- Simple horizontal filter menu -->
		<div class="mb-4 flex justify-between gap-2 pb-2 text-sm font-medium text-gray-600">
			<!-- All notes tab -->
			<button
				class="flex items-center gap-2 rounded-md px-3 py-1 transition hover:bg-gray-100
		{$selectedKind.value === 'all' ? 'bg-gray-200 font-semibold text-black' : ''}"
				on:click={() => setSelectedKind({ value: 'all', label: 'Alla anteckningar' })}
			>
				<Icon icon="Notes" size="18px" />
				<span class="hidden sm:inline">Alla anteckningar</span>
			</button>

			<!-- Note kinds from DB -->
			{#each $noteKinds as kind}
				<button
					class="flex items-center gap-2 rounded-md px-3 py-1 transition hover:bg-gray-100
			{$selectedKind.value === kind.id ? 'bg-gray-200 font-semibold text-black' : ''}"
					on:click={() => setSelectedKind({ value: kind.id, label: kind.title })}
				>
					<Icon icon={noteKindIcons[kind.id] || noteKindIcons.default} size="18px" />
					<span class="hidden sm:inline">{kind.title}</span>
				</button>
			{/each}
		</div>
	{/if}

	<div class="flex h-full flex-col gap-4 pb-12">
		{#each $notes as note (note.id)}
			<div class="rounded-lg border border-gray-bright bg-white p-4 shadow-md">
				<div class="flex flex-row items-center gap-2">
					{#if note.note_kind.id == 1}
						<Icon icon="BasicInfo" size="20px" color="orange" />{:else if note.note_kind.id == 2}
						<Icon icon="HandoverInfo" size="20px" color="orange" />{:else if note.note_kind.id == 3}
						<Icon icon="CircleInfo" size="20px" color="orange" />{:else}
						<Icon icon="Notes" size="20px" color="orange" />{/if}

					{#if note.note_kind.title}
						<p class="text-xs font-semibold text-orange">{note.note_kind.title}</p>
					{:else}
						<p class="text-xs font-semibold text-orange">Anteckning</p>
					{/if}
				</div>

				<div class="">
					<QuillViewer content={note.text} key={note.id} />
				</div>
				<p class="text-xs text-gray-medium">{new Date(note.created_at).toLocaleString()}</p>
			</div>
		{:else}
			<p class="text-gray-200">Inga anteckningar ännu.</p>
		{/each}
	</div>
</div>
