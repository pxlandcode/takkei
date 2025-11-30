<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	export let packageId: number;
	export let showClientColumn: boolean;
	const dispatch = createEventDispatcher();

	let bookings: any[] = [];
	let loading = false;
	let err: string | null = null;

	async function fetchBookings() {
		loading = true;
		err = null;
		try {
			const res = await fetch(`/api/packages/${packageId}/bookings`);
			if (!res.ok) throw new Error(await res.text());
			bookings = await res.json();
		} catch (e: any) {
			err = e?.message ?? 'Kunde inte hämta bokningar';
		} finally {
			loading = false;
		}
	}

	async function removeFromPackage(bookingId: number) {
		if (!confirm('Är du säker?')) return;
		const res = await fetch(`/api/bookings/${bookingId}/remove-from-package`, { method: 'POST' });
	if (!res.ok) {
		const t = await res.text();
		let msg = t;
		try {
			const parsed = JSON.parse(t);
			msg = parsed?.error || t;
		} catch {
			// ignore
		}
		throw new Error(msg);
	}
		await fetchBookings();
		dispatch('changed'); // tell parent to refresh pkg counters
	}

	onMount(fetchBookings);
</script>

{#if loading}
	<p>Laddar bokningar…</p>
{:else if err}
	<p class="text-red-600">{err}</p>
{:else if bookings.length === 0}
	<p>Det finns inga bokningar för detta paket</p>
{:else}
	<div class="overflow-auto">
		<table class="min-w-[720px] table-auto">
			<thead>
				<tr class="border-b text-left">
					<th class="py-2 pr-4">Datum / tid</th>
					<th class="py-2 pr-4">Tränare</th>
					{#if showClientColumn}<th class="py-2 pr-4">Klient</th>{/if}
					<th class="py-2 pr-4"></th>
				</tr>
			</thead>
			<tbody>
				{#each bookings as b}
					<tr class="border-b">
						<td class="py-2 pr-4">
							{#if b.is_saldojustering}
								<a class="text-blue-600 underline" href={`/settings/bookings/${b.id}`}>{b.date}</a
								><br />
								<span class="rounded-sm bg-red-100 px-2 py-0.5 text-xs text-red-700">
									Saldojustering / {b.trainer_name}
								</span>
							{:else}
								<a class="text-blue-600 underline" href={`/settings/bookings/${b.id}`}
									>{b.datetime}</a
								>
							{/if}
						</td>
						<td class="py-2 pr-4">{b.is_saldojustering ? '–' : b.trainer_name}</td>
						{#if showClientColumn}<td class="py-2 pr-4">{b.client_name}</td>{/if}
						<td class="py-2 pr-4 text-right">
							<div class="flex justify-end gap-2">
								<a class="text-gray-700 underline" href={`/settings/bookings/${b.id}`}>Detaljer</a>
								<button class="text-red-600 underline" on:click={() => removeFromPackage(b.id)}
									>Ta bort från paketet</button
								>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<div class="mt-2 text-sm">Antal: {bookings.length}</div>
	</div>
{/if}
