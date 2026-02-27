<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import Button from '../../../bits/button/Button.svelte';

	export let packageId: number;
	export let isAdmin: boolean = false;

	let notes: any[] = [];
	let loading = false;
	let err: string | null = null;
	let newNoteText = '';
	let isSubmitting = false;

	// Placeholder - API to be implemented
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
		if (!newNoteText.trim()) return;
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

<div class="space-y-4">
	<!-- Add note section -->
	{#if isAdmin}
		<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
			<div class="mb-3 flex items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600"
				>
					<Icon icon="Plus" size="16px" />
				</div>
				<h4 class="text-lg font-semibold text-gray-900">Lägg till anteckning</h4>
			</div>
			<textarea
				class="w-full rounded-sm border border-gray-200 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				rows="3"
				placeholder="Skriv en anteckning..."
				bind:value={newNoteText}
			></textarea>
			<div class="mt-3 flex justify-end">
				<Button
					text="Spara"
					icon="Check"
					variant="primary"
					disabled={isSubmitting || !newNoteText.trim()}
					on:click={submitNote}
				/>
			</div>
		</div>
	{/if}

	<!-- Notes list -->
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
		<div class="space-y-3">
			{#each notes as note (note.id)}
				<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
					<div class="mb-2 flex items-start justify-between gap-4">
						<div class="flex items-center gap-2">
							<div
								class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600"
							>
								<Icon icon="User" size="14px" />
							</div>
							<div>
								<p class="text-sm font-medium text-gray-900">
									{note.writer?.firstname ?? 'Okänd'}
									{note.writer?.lastname ?? ''}
								</p>
								<p class="text-xs text-gray-500">{formatDate(note.created_at)}</p>
							</div>
						</div>
						{#if note.note_kind}
							<span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
								{note.note_kind.name}
							</span>
						{/if}
					</div>
					<div class="prose prose-sm max-w-none text-gray-700">
						{@html note.text}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
