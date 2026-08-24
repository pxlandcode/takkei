<script lang="ts">
	import { browser } from '$app/environment';
	import type { FullBooking } from '$lib/types/calendarTypes';
	import OptionButton from '../../bits/optionButton/OptionButton.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { formatTime } from '$lib/helpers/calendarHelpers/calendar-utils';
	import {
		IconCancel,
		IconTraining,
		IconShiningStar,
		IconGraduationCap,
		IconPlane
	} from '$lib/icons';
	import IconWrench from '$icons/IconWrench.svelte';

	export let bookings: FullBooking[] = [];
	export let clientId: number | null = null;
	export let syncPageUrl: string | null = null;
	export let privacyMode = false;
	export let allowCancelledBookings = true;
	export let filterOptions = [
		{ value: 'active', label: 'Visa bokade' },
		{ value: 'cancelled', label: 'Visa avbokade' },
		{ value: 'all', label: 'Visa alla' }
	];

	let selectedFilter = filterOptions[0];
	let isCreatingSyncLink = false;
	let syncError = '';

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
		if (!allowCancelledBookings) {
			return filtered.filter((b) => !isCancelledStatus(b.booking.status));
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
		if (privacyMode) return IconTraining;
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

	function getBookingMeta(booking: FullBooking) {
		const parts = [booking.location?.name ?? 'Okänd plats'];

		if (!privacyMode) {
			const trainerName = `${booking.trainer?.firstname ?? ''} ${
				booking.trainer?.lastname ?? ''
			}`.trim();
			if (trainerName) {
				parts.push(trainerName);
			}
		}

		return parts.join(' · ');
	}

	async function handleSyncCalendar() {
		if (!browser || isCreatingSyncLink) return;

		if (syncPageUrl) {
			window.location.assign(syncPageUrl);
			return;
		}

		if (!clientId) return;

		isCreatingSyncLink = true;
		syncError = '';

		try {
			const response = await fetch(`/api/clients/${clientId}/calendar-subscription`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({})
			});

			if (!response.ok) {
				throw new Error('Kunde inte skapa kalenderlänken.');
			}

			const payload = await response.json();
			if (typeof payload?.syncPageUrl !== 'string') {
				throw new Error('Kalenderlänken saknas i svaret.');
			}

			window.location.assign(payload.syncPageUrl);
		} catch (error) {
			console.error('Failed to create calendar sync link', error);
			syncError = 'Kunde inte skapa kalenderlänken. Försök igen eller kontakta din tränare.';
		} finally {
			isCreatingSyncLink = false;
		}
	}
</script>

<div class="space-y-3">
	<div class="controls">
		<div class="filters">
			<div class="date-filter w-full md:max-w-xs">
				<label
					class="text-xs font-semibold tracking-wide text-gray-500 uppercase"
					for="booking-list-start-date">Från datum</label
				>
				<input
					id="booking-list-start-date"
					type="date"
					bind:value={selectedDate}
					class="date-input"
				/>
			</div>
			{#if allowCancelledBookings}
				<div class="filter-toggle">
					<OptionButton
						label="Status"
						options={filterOptions}
						bind:selectedOption={selectedFilter}
						size="medium"
						full
					/>
				</div>
			{/if}
		</div>
		<div class="calendar-actions">
			<Button
				text={isCreatingSyncLink ? 'Skapar länk...' : 'Prenumerera'}
				iconLeft="CalendarCheck"
				iconLeftSize="16px"
				variant="primary"
				disabled={(!clientId && !syncPageUrl) || isCreatingSyncLink}
				on:click={handleSyncCalendar}
			/>
		</div>
	</div>
	{#if syncError}
		<p class="text-sm text-red-600">{syncError}</p>
	{/if}
	{#if visibleBookings.length === 0}
		<p class="text-sm text-gray-500">Inga bokningar hittades.</p>
	{:else}
		{#each visibleBookings as booking (booking.booking.id)}
			<div
				class="booking-slot w-full rounded-sm border p-4 text-left text-sm transition-all"
				class:cancelled={booking.booking.status === 'Cancelled'}
				class:late-cancelled={booking.booking.status === 'Late_cancelled'}
				style="background-color: {getLocationColor(booking)}22; border-color: {getLocationColor(
					booking
				)};"
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
							{formatDate(booking.booking.startTime)}
							{formatTime(booking.booking.startTime)} -
							{formatTime(getEndTime(booking))}
						</p>
						<p class="text-xs text-gray-500">
							{getBookingMeta(booking)}
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
			align-items: flex-end;
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
			align-items: flex-end;
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
		height: 46px;
		border-radius: 0.25rem;
		border: 1px solid #3e3e3e;
		padding: 0 0.65rem;
		font-size: 0.9rem;
		color: #3e3e3e;
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
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
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

	.calendar-actions {
		display: flex;
		width: 100%;
		flex-direction: column;
		gap: 0.5rem;
	}

	@media (min-width: 768px) {
		.calendar-actions {
			width: auto;
			flex-direction: row;
			align-items: center;
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
