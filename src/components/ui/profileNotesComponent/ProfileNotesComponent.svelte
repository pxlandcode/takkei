<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchNotes, addNote, updateNote } from '$lib/services/api/notesService';
	import { writable } from 'svelte/store';
	import Button from '../../bits/button/Button.svelte';
	import { user } from '$lib/stores/userStore';
	import QuillEditor from '../../bits/quillEditor/QuillEditor.svelte';
	import QuillViewer from '../../bits/quillViewer/QuillViewer.svelte';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import { linkNoteToBooking, unlinkNoteFromBooking } from '$lib/services/api/bookingNotesService';
	import { fetchBookingById } from '$lib/services/api/calendarService';
	import BookingDetailsPopup from '../bookingDetailsPopup/BookingDetailsPopup.svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import NoteBookingSelectPopup from './NoteBookingSelectPopup.svelte';
	import { openPopup } from '$lib/stores/popupStore';

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
	let isLinkingNoteId: number | null = null;
	let editingNoteId: number | null = null;
	let editingNoteText = '';
	let editingNoteKindId: number | null = null;
	let isSavingEdit = false;
	let linkedBookingLabels: Record<number, string> = {};
	let linkedBookingData: Record<number, any> = {};

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

	function startEditing(note) {
		editingNoteId = note.id;
		editingNoteText = note.text ?? '';
		editingNoteKindId = note.note_kind?.id ?? note.note_kind_id ?? null;
	}

	function cancelEditing() {
		editingNoteId = null;
		editingNoteText = '';
		editingNoteKindId = null;
		isSavingEdit = false;
	}

	async function saveEditing() {
		if (!editingNoteId) return;
		isSavingEdit = true;
		const updated = await updateNote(editingNoteId, editingNoteText, fetch, editingNoteKindId);
		isSavingEdit = false;

		if (updated) {
			allNotes.update((existing: any[]) =>
				existing.map((note) => (note.id === editingNoteId ? updated : note))
			);
			filterNotes();
			cancelEditing();
			// reset link spinner state
			isLinkingNoteId = null;
		}
	}

	async function openBookingLinkPopup(noteId: number) {
		if (!isClient || !targetId) return;

		openPopup({
			header: 'Koppla till bokning',
			icon: 'Calendar',
			component: NoteBookingSelectPopup,
			maxWidth: '800px',
			props: {
				clientId: targetId,
				onSelect: async ({ bookingId, bookingLabel, booking }) => {
					if (!bookingId) return;

					isLinkingNoteId = noteId;
					const linked = await linkNoteToBooking(bookingId, noteId, fetch);
					isLinkingNoteId = null;

					if (linked) {
						if (bookingLabel) {
							linkedBookingLabels = { ...linkedBookingLabels, [noteId]: bookingLabel };
						}
						if (booking) {
							linkedBookingData = { ...linkedBookingData, [noteId]: booking };
						}
						allNotes.update((existing: any[]) =>
							existing.map((note) => (note.id === noteId ? linked : note))
						);
						filterNotes();
					} else {
						console.warn(
							'[ProfileNotesComponent] Link failed; check API /api/booking_notes response or DB table booking_notes.'
						);
					}
				}
			}
		});
	}

	async function openLinkedBooking(note: any) {
		const bookingId = note?.linked_booking_id;
		if (!bookingId) return;

		let booking = linkedBookingData[note.id];
		if (!booking) {
			booking = await fetchBookingById(bookingId, fetch);
			if (!booking) {
				addToast({
					type: AppToastType.CANCEL,
					message: 'Kunde inte hitta bokning',
					description: 'Bokningsdetaljer kunde inte laddas.'
				});
				return;
			}
			linkedBookingData = { ...linkedBookingData, [note.id]: booking };
		}

		openPopup({
			header: 'Bokningsdetaljer',
			icon: 'CircleInfo',
			component: BookingDetailsPopup,
			props: { booking },
			maxWidth: '650px',
			height: '850px'
		});
	}

	async function unlinkBooking(note: any) {
		if (!note?.id) return;
		isLinkingNoteId = note.id;
		const success = await unlinkNoteFromBooking(note.id, fetch);
		isLinkingNoteId = null;

		if (!success) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Koppling kunde inte tas bort',
				description: 'Försök igen eller uppdatera sidan.'
			});
			return;
		}

		allNotes.update((existing: any[]) =>
			existing.map((n) =>
				n.id === note.id
					? {
							...n,
							linked_booking_id: null
						}
					: n
			)
		);
		linkedBookingLabels = { ...linkedBookingLabels, [note.id]: undefined };
		delete linkedBookingData[note.id];
		filterNotes();
	}
</script>

<div class="custom-scrollbar flex h-full flex-col gap-4 overflow-y-auto">
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

	<div class="border-gray-bright flex w-full flex-row items-center justify-between border-b pb-2">
		<h3 class="text-xl">Anteckningar</h3>

		<!-- Filter menu for note kinds -->
	</div>
	{#if isClient && $noteKinds.length > 0}
		<!-- Simple horizontal filter menu -->
		<div class="mb-4 flex justify-between gap-2 pb-2 text-sm font-medium text-gray-600">
			<!-- All notes tab -->
			<button
				class="flex items-center gap-2 rounded-sm px-3 py-1 transition hover:bg-gray-100
		{$selectedKind.value === 'all' ? 'bg-gray-200 font-semibold text-black' : ''}"
				on:click={() => setSelectedKind({ value: 'all', label: 'Alla anteckningar' })}
			>
				<Icon icon="Notes" size="18px" />
				<span class="hidden sm:inline">Alla anteckningar</span>
			</button>

			<!-- Note kinds from DB -->
			{#each $noteKinds as kind}
				<button
					class="flex items-center gap-2 rounded-sm px-3 py-1 transition hover:bg-gray-100
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
			<div class="border-gray-bright rounded-sm border bg-white p-4 shadow-md">
				<div class="flex flex-row items-start justify-between gap-2">
					<div class="flex flex-row items-center gap-2">
						{#if (note.note_kind?.id ?? null) == 1}
							<Icon
								icon="BasicInfo"
								size="20px"
								color="orange"
							/>{:else if (note.note_kind?.id ?? null) == 2}
							<Icon
								icon="HandoverInfo"
								size="20px"
								color="orange"
							/>{:else if (note.note_kind?.id ?? null) == 3}
							<Icon icon="CircleInfo" size="20px" color="orange" />{:else}
							<Icon icon="Notes" size="20px" color="orange" />{/if}

						{#if note.note_kind?.title}
							<p class="text-orange text-xs font-semibold">{note.note_kind.title}</p>
						{:else}
							<p class="text-orange text-xs font-semibold">Anteckning</p>
						{/if}
					</div>

					{#if isClient && note.linked_booking_id}
						<div class="flex flex-wrap items-center gap-2">
							<Button
								variant="secondary"
								icon="Calendar"
								small
								on:click={() => openLinkedBooking(note)}
								title={linkedBookingLabels[note.id] ?? `Bokning #${note.linked_booking_id}`}
							/>
						</div>
					{/if}
				</div>

				<div class="">
					{#if editingNoteId === note.id}
						<div class="mt-2 space-y-2 rounded-sm">
							<QuillEditor
								content={editingNoteText}
								on:change={(e) => (editingNoteText = e.detail)}
							/>
							<div class="flex flex-col justify-between gap-2 sm:flex-row sm:items-center sm:gap-3">
								<div class="w-48">
									<Dropdown
										id={`edit-kind-${note.id}`}
										label="Anteckningstyp"
										placeholder="Anteckning"
										options={[
											{ label: 'Anteckning', value: null },
											...$noteKinds.map((k) => ({
												label: k.title,
												value: k.id
											}))
										]}
										bind:selectedValue={editingNoteKindId}
									/>
								</div>
								<div class="mt-7 flex gap-2">
									<Button
										text={isSavingEdit ? 'Sparar...' : 'Spara'}
										variant="primary"
										small
										disabled={isSavingEdit}
										on:click={saveEditing}
									/>
									<Button text="Avbryt" variant="secondary" small on:click={cancelEditing} />
								</div>
							</div>
						</div>
					{:else}
						<QuillViewer content={note.text} key={note.id} />
					{/if}
				</div>

				<div
					class="text-gray-medium mt-2 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between"
				>
					<p>{new Date(note.created_at).toLocaleString()}</p>
					<div class="flex flex-wrap gap-2">
						{#if isClient && !note.linked_booking_id && editingNoteId !== note.id}
							<Button
								text={isLinkingNoteId === note.id ? 'Kopplar...' : 'Koppla bokning'}
								variant="primary"
								small
								disabled={isLinkingNoteId === note.id}
								on:click={() => openBookingLinkPopup(note.id)}
							/>
						{/if}

						{#if isClient && note.linked_booking_id && editingNoteId !== note.id}
							<Button
								text={isLinkingNoteId === note.id ? 'Tar bort...' : 'Ta bort koppling'}
								variant="danger-outline"
								small
								disabled={isLinkingNoteId === note.id}
								confirmOptions={{
									title: 'Ta bort koppling?',
									description: 'Är du säker på att du vill ta bort kopplingen till bokningen?',
									action: () => unlinkBooking(note)
								}}
							/>
						{/if}

						{#if editingNoteId !== note.id}
							<Button
								text="Redigera"
								variant="secondary"
								small
								on:click={() => startEditing(note)}
							/>
						{/if}
					</div>
				</div>
			</div>
		{:else}
			<p class="text-gray-200">Inga anteckningar ännu.</p>
		{/each}
	</div>
</div>
