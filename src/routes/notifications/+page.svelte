<script lang="ts">
	import { onMount } from 'svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import { user } from '$lib/stores/userStore';
	import NotificationCard from '../../components/bits/notificationCard/NotificationCard.svelte';
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import Button from '../../components/bits/button/Button.svelte';
	import { notificationStore } from '$lib/stores/notificationStore';
	import { invalidateByPrefix, wrapFetch } from '$lib/services/api/apiCache';

	$: $user;

	let events = [];
	let expanded = new Set<number>();
	let isLoading = true;
	const fetchWithCache = wrapFetch(fetch);

	function toggleExpand(id: number) {
		expanded.has(id) ? expanded.delete(id) : expanded.add(id);
	}

	async function fetchNotifications() {
		if (!$user?.id) return;

		isLoading = true;
		try {
			const res = await fetchWithCache(`/api/notifications?user_id=${$user.id}`);
			if (!res.ok) throw new Error('Kunde inte hämta notifikationer');
			const all = await res.json();

			// Sort: alerts first, then by start_time descending
			events = all.sort((a, b) => {
				if (a.event_type === 'alert' && b.event_type !== 'alert') return -1;
				if (a.event_type !== 'alert' && b.event_type === 'alert') return 1;
				return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
			});
		} catch (err) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid hämtning',
				description: err.message
			});
		} finally {
			isLoading = false;
		}
	}

	async function markAsDone(eventId: number) {
		try {
			await fetch('/api/notifications', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ event_id: eventId, user_id: $user.id })
			});
			events = events.filter((e) => e.id !== eventId);
			invalidateByPrefix('/api/notifications');

			addToast({
				type: AppToastType.SUCCESS,
				message: 'Markerad som klar',
				description: 'Notifikationen är markerad som klar.'
			});
			notificationStore.updateFromServer($user.id);
		} catch (err) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid uppdatering',
				description: err.message
			});
		}
	}

	onMount(fetchNotifications);

	function relativeTime(iso: string): string {
		const diff = Date.now() - new Date(iso).getTime();
		const minutes = Math.floor(diff / 60000);
		if (minutes < 1) return 'just nu';
		if (minutes < 60) return `${minutes} minuter sen`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours} timmar sen`;
		const days = Math.floor(hours / 24);
		return `${days} dagar sen`;
	}
</script>

<div class="m-4 ml-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
	<div class="flex flex-row items-center gap-2">
		<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="Notification" size="18px" />
		</div>
		<h2 class="text-3xl font-semibold text-text">Dina Notifikationer</h2>
	</div>
</div>

{#if isLoading}
	<p class="text-gray-500">Laddar notifikationer...</p>
{:else if events.length === 0}
	<p class="text-gray-500">Du har inga aktiva notifikationer.</p>
{:else}
	<div class="max-h-[80vh] overflow-y-auto px-4">
		<div class="flex flex-col items-center">
			{#each events as event (event.id)}
				<div class="w-full p-2">
					<NotificationCard
						title={event.name}
						message={event.description}
						timeAgo={relativeTime(event.start_time)}
						type={event.event_type}
						startTime={event.start_time}
						endTime={event.end_time}
						createdBy={event.created_by?.name}
						on:done={() => markAsDone(event.id)}
					/>
				</div>
			{/each}
		</div>
	</div>
{/if}
