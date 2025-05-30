<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { user } from '$lib/stores/userStore';

	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	let alerts = [];
	let currentIndex = 0;

	onMount(fetchAlerts);

	async function fetchAlerts() {
		const currentUser = get(user);
		if (!currentUser?.id) return;

		try {
			const res = await fetch(`/api/notifications?user_id=${currentUser.id}&type=2`);
			if (!res.ok) throw new Error('Kunde inte hämta viktiga meddelanden');
			alerts = await res.json();
			currentIndex = 0;
		} catch (err) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid hämtning',
				description: err.message
			});
		}
	}

	function formatDate(date: string | null) {
		if (!date) return '';
		return new Date(date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
	}

	function getDateRange(start: string | null, end: string | null): string {
		if (!start) return '';
		if (!end || formatDate(start) === formatDate(end)) {
			return formatDate(start);
		}
		return `${formatDate(start)} – ${formatDate(end)}`;
	}

	async function confirmAndNext() {
		const currentUser = get(user);
		const current = alerts[currentIndex];
		if (!current || !currentUser?.id) return;

		try {
			const res = await fetch('/api/notifications', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					event_id: current.id,
					user_id: currentUser.id
				})
			});

			if (!res.ok) throw new Error('Misslyckades att markera som läst');

			alerts = [...alerts.slice(0, currentIndex), ...alerts.slice(currentIndex + 1)];

			if (alerts.length === 0) {
				dispatch('finished');
			} else if (currentIndex >= alerts.length) {
				currentIndex = alerts.length - 1;
			}
		} catch (err) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte markera som läst',
				description: err.message
			});
		}
	}
</script>

{#if alerts.length === 0}
	<p class="text-sm text-gray-500">Inga aktiva viktiga meddelanden.</p>
{:else if alerts[currentIndex]}
	<div class="flex w-[600px] max-w-[600px] flex-col gap-4 p-1">
		<!-- Alert Box -->
		<div class="rounded-lg bg-red-50 p-4 shadow-sm">
			<div class="flex items-start gap-3">
				<div class="color-error mt-1">
					<Icon icon="CircleAlert" size="20px" />
				</div>
				<div class="flex-1">
					<div class="flex flex-row justify-between">
						<h2 class="text-lg font-semibold text-error">{alerts[currentIndex].name}</h2>
						{#if alerts.length > 1}
							<p class="text-sm text-gray-500">
								{currentIndex + 1}/{alerts.length}
							</p>
						{/if}
					</div>

					{#if alerts[currentIndex].start_time}
						<p class="mt-1 text-xs text-gray-500">
							{getDateRange(alerts[currentIndex].start_time, alerts[currentIndex].end_time)}
							{#if alerts[currentIndex].created_by}
								– {alerts[currentIndex].created_by.name}
							{/if}
						</p>
					{/if}

					<p class="mt-3 whitespace-pre-line text-sm text-gray-800">
						{alerts[currentIndex].description}
					</p>
				</div>
			</div>
		</div>

		<!-- Footer -->
		<div class="mt-2 flex items-center justify-end border-t pt-4">
			<button
				on:click={confirmAndNext}
				class="rounded bg-error px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
			>
				Jag säkerställer att jag har läst
			</button>
		</div>
	</div>
{/if}
