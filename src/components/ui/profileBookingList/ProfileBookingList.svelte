<script lang="ts">
	import { browser } from '$app/environment';
	import type { FullBooking } from '$lib/types/calendarTypes';
	import OptionButton from '../../bits/optionButton/OptionButton.svelte';
	import { formatTime } from '$lib/helpers/calendarHelpers/calendar-utils';
	import { downloadBookingsAsICS } from '$lib/helpers/calendarHelpers/booking-ics';
	import {
		IconCancel,
		IconTraining,
		IconShiningStar,
		IconGraduationCap,
		IconPlane,
		IconDownload
	} from '$lib/icons';
	import IconWrench from '$icons/IconWrench.svelte';

	export let bookings: FullBooking[] = [];
	export let filterOptions = [
		{ value: 'active', label: 'Visa bokade' },
		{ value: 'cancelled', label: 'Visa avbokade' },
		{ value: 'all', label: 'Visa alla' }
	];

	let selectedFilter = filterOptions[0];

	const today = new Date();
	const defaultStart = new Date(today);
	defaultStart.setMonth(defaultStart.getMonth() - 1);
	const toYMD = (date: Date) => date.toISOString().slice(0, 10);
	let selectedDate = toYMD(defaultStart);

	const cancelledStatuses = new Set(['Cancelled', 'Late_cancelled', 'CancelledLate']);
	const locationColors = new Map<string | number, string>();

	function getLocationColor(booking: FullBooking) {
		const loc = booking.location;
		if (!loc) return '#94a3b8';
		const key = loc.id ?? loc.name;
		if (key == null) return '#94a3b8';
		if (locationColors.has(key)) return locationColors.get(key)!;
		const color = loc.color ?? '#22d3ee';
		locationColors.set(key, color);
		return color;
	}

	function isCancelledStatus(status?: string | null) {
		if (!status) return false;
		return cancelledStatuses.has(status);
	}

	$: visibleBookings = (() => {
		let filtered = bookings;
		if (selectedDate) {
			const cutoff = new Date(`${selectedDate}T00:00:00`);
			filtered = filtered.filter((b) => new Date(b.booking.startTime) >= cutoff);
		}
		if (selectedFilter.value === 'cancelled') {
			return filtered.filter((b) => isCancelledStatus(b.booking.status));
		}
		if (selectedFilter.value === 'active') {
			return filtered.filter((b) => !isCancelledStatus(b.booking.status));
		}
		return filtered;
	})();

	function formatDate(date: string) {
		return new Date(date).toLocaleDateString('sv-SE', {
			month: 'short',
			day: 'numeric'
		});
	}

	function getBookingIcon(booking: FullBooking) {
		if (booking.booking.status && isCancelledStatus(booking.booking.status)) return IconCancel;
		if (booking.booking.tryOut) return IconShiningStar;
		if (booking.booking.internalEducation) return IconWrench;
		if (booking.additionalInfo?.education) return IconGraduationCap;
		if (booking.additionalInfo?.internal) return IconPlane;
		return IconTraining;
	}

	function getHeadline(booking: FullBooking) {
		if (booking.booking.status === 'Cancelled') return 'Avbokad';
		if (booking.booking.status === 'Late_cancelled') return 'Sen avbokning';
		return booking.additionalInfo?.bookingContent?.kind ?? 'Bokning';
	}

	function getEndTime(booking: FullBooking) {
		return (
			booking.booking.endTime ??
			new Date(new Date(booking.booking.startTime).getTime() + 60 * 60 * 1000).toISOString()
		);
	}

	function getDownloadFileName() {
		return 'Takkei - Träning';
	}

	function handleDownloadAll() {
		if (!browser || visibleBookings.length === 0) return;
		downloadBookingsAsICS(visibleBookings, getDownloadFileName());
	}
</script>

<div class="space-y-3">
	<div class="controls">
		<div class="filters">
			<div class="date-filter w-full md:max-w-xs">
				<label class="text-xs font-semibold uppercase tracking-wide text-gray-500"
					>Från datum</label
				>
				<input type="date" bind:value={selectedDate} class="date-input" />
			</div>
			<div class="filter-toggle">
				<OptionButton
					options={filterOptions}
					bind:selectedOption={selectedFilter}
					size="medium"
					full
				/>
			</div>
		</div>
		<button
			type="button"
			class="download-button"
			on:click={handleDownloadAll}
			disabled={visibleBookings.length === 0}
		>
			<IconDownload size="16px" />
			<span>Lägg till i kalender</span>
		</button>
	</div>
	{#if visibleBookings.length === 0}
		<p class="text-sm text-gray-500">Inga bokningar hittades.</p>
	{:else}
		{#each visibleBookings as booking (booking.booking.id)}
			<div
				class="booking-slot w-full rounded-sm border p-4 text-left text-sm transition-all"
				class:cancelled={booking.booking.status === 'Cancelled'}
				class:late-cancelled={booking.booking.status === 'Late_cancelled'}
				style="background-color: {getLocationColor(booking)}22; border-color: {getLocationColor(booking)};"
			>
				{#if booking.booking.status === 'Cancelled'}
					<div class="cancelled-overlay"></div>
				{:else if booking.booking.status === 'Late_cancelled'}
					<div class="late-cancelled-overlay"></div>
				{/if}

				<div class="flex items-center gap-3">
					<div class="icon-pill" style={`color: ${getLocationColor(booking)};`}>
						<svelte:component this={getBookingIcon(booking)} size="20px" />
					</div>
					<div class="flex flex-col gap-1 text-gray-800">
						<p class="text-base font-semibold">{getHeadline(booking)}</p>
						<p class="text-sm text-gray-600">
							{formatDate(booking.booking.startTime)} {formatTime(booking.booking.startTime)} -
							{formatTime(getEndTime(booking))}
						</p>
						<p class="text-xs text-gray-500">
							{booking.location?.name ?? 'Okänd plats'} &middot; {booking.trainer?.firstname} {booking.trainer?.lastname}
						</p>
					</div>
				</div>
			</div>
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

	.date-filter {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.date-input {
		width: 100%;
		border-radius: 0.375rem;
		border: 1px solid #cbd5f5;
		padding: 0.45rem 0.65rem;
		font-size: 0.9rem;
		color: #0f172a;
		background: white;
	}

	.date-input:focus {
		outline: 2px solid #94a3b8;
		outline-offset: 0;
	}

	.booking-slot {
		position: relative;
		overflow: hidden;
		border-radius: 0.5rem;
		border-width: 1px;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
		box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
	}

	.icon-pill {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 999px;
		background: white;
		box-shadow: 0 4px 10px rgba(15, 23, 42, 0.1);
	}

	.booking-slot.cancelled {
		opacity: 0.75;
	}

	.booking-slot.late-cancelled {
		opacity: 0.85;
	}

	.download-button {
		width: 100%;
		border: 1px solid #0284c7;
		border-radius: 0.5rem;
		background: #e0f2fe;
		color: #0f172a;
		font-weight: 600;
		font-size: 0.95rem;
		padding: 0.55rem 0.9rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
		transition: background-color 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
	}

	.download-button:hover:not(:disabled) {
		background-color: #bae6fd;
		transform: translateY(-1px);
	}

	.download-button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
		box-shadow: none;
	}

	@media (min-width: 768px) {
		.download-button {
			width: auto;
		}
	}

	.cancelled-overlay,
	.late-cancelled-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		border-radius: 6px;
	}

	.cancelled-overlay {
		background-image: repeating-linear-gradient(
			-45deg,
			rgba(0, 0, 0, 0.08) 0px,
			rgba(0, 0, 0, 0.08) 5px,
			transparent 5px,
			transparent 10px
		);
	}

	.late-cancelled-overlay {
		background-image: repeating-linear-gradient(
			45deg,
			rgba(232, 121, 121, 0.18) 0px,
			rgba(232, 121, 121, 0.18) 5px,
			transparent 5px,
			transparent 10px
		);
	}
</style>
