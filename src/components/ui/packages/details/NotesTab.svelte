<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import Button from '../../../bits/button/Button.svelte';
	import QuillEditor from '../../../bits/quillEditor/QuillEditor.svelte';
	import QuillViewer from '../../../bits/quillViewer/QuillViewer.svelte';

	export let packageId: number;
	export let isAdmin: boolean = false;

	let notes: any[] = [];
	let loading = false;
	let err: string | null = null;
	let newNoteText = '';
	let isSubmitting = false;

	function handleTextChange(event: CustomEvent<string>) {
		newNoteText = event.detail;
	}

	function hasVisibleContent(html: string) {
		const plain = html
			.replace(/<br\s*\/?>/gi, ' ')
			.replace(/<[^>]*>/g, ' ')
			.replace(/&nbsp;/gi, ' ')
			.trim();

		return plain.length > 0;
	}

	async function fetchNotes() {
		loading = true;
		err = null;
		try {
			const res = await fetch(`/api/packages/${packageId}/notes`);
			if (res.status === 404) {
				// API not implemented yet
				notes = [];
				return;
			}
			if (!res.ok) throw new Error(await res.text());
			notes = await res.json();
		} catch (e: any) {
			// Silently handle missing API
			notes = [];
		} finally {
			loading = false;
		}
	}

	async function submitNote() {
		if (!hasVisibleContent(newNoteText)) return;
		isSubmitting = true;
		try {
			const res = await fetch(`/api/packages/${packageId}/notes`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: newNoteText })
			});
			if (!res.ok) throw new Error(await res.text());
			newNoteText = '';
			await fetchNotes();
		} catch (e: any) {
			err = e?.message ?? 'Kunde inte spara anteckning';
		} finally {
			isSubmitting = false;
		}
	}

	onMount(fetchNotes);

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('sv-SE', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="custom-scrollbar flex h-full flex-col gap-4 overflow-y-auto">
	{#if isAdmin}
		<div>
			<QuillEditor content={newNoteText} on:change={handleTextChange} />
		</div>

		<div class="full-w flex justify-end">
			<Button
				text="Lägg till anteckning"
				variant="primary"
				on:click={submitNote}
				disabled={isSubmitting || !hasVisibleContent(newNoteText)}
			/>
		</div>
	{/if}

	<div class="border-gray-bright flex w-full flex-row items-center justify-between border-b pb-2">
		<h3 class="text-xl">Anteckningar</h3>
	</div>

	{#if loading}
		<div class="flex items-center gap-2 py-8 text-gray-500">
			<Icon icon="Refresh" size="18px" extraClasses="animate-spin" />
			<span>Laddar anteckningar…</span>
		</div>
	{:else if err}
		<div class="rounded-sm border border-red-200 bg-red-50 p-4 text-red-700">
			<p>{err}</p>
		</div>
	{:else if notes.length === 0}
		<div class="rounded-sm border border-gray-200 bg-gray-50 p-8 text-center">
			<Icon icon="Notes" size="32px" color="#9ca3af" />
			<p class="mt-2 text-gray-500">Inga anteckningar ännu</p>
			{#if isAdmin}
				<p class="mt-1 text-sm text-gray-400">
					Använd formuläret ovan för att lägga till en anteckning.
				</p>
			{/if}
		</div>
	{:else}
		<div class="flex h-full flex-col gap-4 pb-12">
			{#each notes as note (note.id)}
				<div class="border-gray-bright rounded-sm border bg-white p-4 shadow-md">
					<div class="flex flex-row items-start justify-between gap-2">
						<div class="flex flex-row items-center gap-2">
							<Icon icon="Notes" size="20px" color="orange" />
							<p class="text-orange text-xs font-semibold">Anteckning</p>
						</div>
					</div>

					<div>
						<QuillViewer content={note.text} key={note.id} />
					</div>

					<div
						class="text-gray-medium mt-2 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between"
					>
						<p>{formatDate(note.created_at)}</p>
						<p class="text-right">
							{note.writer?.firstname ?? 'Okänd'}
							{note.writer?.lastname ?? ''}
						</p>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
