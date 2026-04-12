<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import OptionButton from '../../../bits/optionButton/OptionButton.svelte';
	import Button from '../../../bits/button/Button.svelte';
	import { openPopup } from '$lib/stores/popupStore';
	import { fetchBookingById } from '$lib/services/api/calendarService';
	import BookingDetailsPopup from '../../bookingDetailsPopup/BookingDetailsPopup.svelte';
	import PackageBookingSlot from './PackageBookingSlot.svelte';

	type PackageBooking = {
		id: number;
		date: string;
		datetime?: string | null;
		is_saldojustering: boolean;
		trainer_name?: string | null;
		client_name?: string | null;
	};

	export let packageId: number;
	export let showClientColumn: boolean;
	export let isAdmin: boolean = false;
	export let refreshToken: number = 0;

	const dispatch = createEventDispatcher();

	let bookings: PackageBooking[] = [];
	let loading = false;
	let err: string | null = null;
	let hasMounted = false;
	let lastRefreshToken: number | null = null;

	// Filter options
	const filterOptions = [
		{ value: 'all', label: 'Alla' },
		{ value: 'upcoming', label: 'Kommande' },
		{ value: 'past', label: 'Passerade' }
	];
	let selectedFilter = filterOptions[0];

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
		const res = await fetch(`/api/packages/${bookingId}/remove-from-package`, { method: 'POST' });
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
		dispatch('changed');
	}

	async function deleteSaldoAdjustment(bookingId: number) {
		const res = await fetch(`/api/saldojustering/${bookingId}`, { method: 'DELETE' });
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
		dispatch('changed');
	}

	async function handleBookingClick(bookingId: number) {
		const booking = await fetchBookingById(bookingId, fetch);
		if (!booking) return;

		openPopup({
			header: 'Bokningsdetaljer',
			icon: 'CircleInfo',
			component: BookingDetailsPopup,
			props: { booking },
			maxWidth: '650px',
			height: '850px',
			listeners: {
				updated: () => {
					fetchBookings();
					dispatch('changed');
				}
			}
		});
	}

	onMount(async () => {
		hasMounted = true;
		lastRefreshToken = refreshToken;
		await fetchBookings();
	});

	$: if (hasMounted && refreshToken !== lastRefreshToken) {
		lastRefreshToken = refreshToken;
		fetchBookings();
	}

	const today = new Date().toISOString().slice(0, 10);

	$: filteredBookings = (() => {
		if (selectedFilter.value === 'upcoming') {
			return bookings.filter((b) => b.date >= today);
		}
		if (selectedFilter.value === 'past') {
			return bookings.filter((b) => b.date < today);
		}
		return bookings;
	})();
</script>

<div class="space-y-3">
	<div class="controls">
		<div class="filters">
			<div class="filter-toggle">
				<OptionButton
					options={filterOptions}
					bind:selectedOption={selectedFilter}
					size="small"
					full
				/>
			</div>
		</div>
		<div class="text-sm text-gray-500">
			{#if !loading}
				{filteredBookings.length} bokningar
			{/if}
		</div>
	</div>

	{#if loading}
		<p class="text-sm text-gray-500">Laddar bokningar…</p>
	{:else if err}
		<div class="rounded-sm border border-red-200 bg-red-50 p-4 text-red-700">
			<p>{err}</p>
		</div>
	{:else if filteredBookings.length === 0}
		<p class="text-sm text-gray-500">Inga bokningar hittades.</p>
	{:else}
		{#each filteredBookings as b (b.id)}
			<PackageBookingSlot
				booking={b}
				{showClientColumn}
				showActions={isAdmin}
				on:bookingClick={(event) => handleBookingClick(event.detail.id)}
			>
				<svelte:fragment slot="actions">
					{#if isAdmin}
						<Button
							text="Ta bort"
							iconLeft="Trash"
							iconColor="error"
							variant="danger-outline"
							small
							confirmOptions={{
								title: b.is_saldojustering ? 'Ta bort saldojustering?' : 'Ta bort från paketet?',
								description: b.is_saldojustering
									? 'Saldojusteringen tas bort och saldot ökar med 1.'
									: 'Bokningen kopplas bort från paketet men tas inte bort.',
								actionLabel: 'Ta bort',
								action: () =>
									b.is_saldojustering ? deleteSaldoAdjustment(b.id) : removeFromPackage(b.id)
							}}
						/>
					{/if}
				</svelte:fragment>
			</PackageBookingSlot>
		{/each}
	{/if}
</div>

<style>
	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	@media (min-width: 768px) {
		.controls {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}
	}

	.filters {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
	}

	@media (min-width: 768px) {
		.filters {
			flex-direction: row;
			align-items: center;
			gap: 1rem;
		}
	}

	.filter-toggle {
		width: 100%;
		max-width: 420px;
	}
</style>
