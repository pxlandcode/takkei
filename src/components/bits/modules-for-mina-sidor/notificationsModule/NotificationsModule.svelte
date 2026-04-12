<script lang="ts">
	import { onMount } from 'svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import { user } from '$lib/stores/userStore';
	import { notificationStore } from '$lib/stores/notificationStore';
	import Icon from '../../icon-component/Icon.svelte';
	import NotificationCard from '../../notificationCard/NotificationCard.svelte';
	import { cacheFirstJson, invalidateByPrefix } from '$lib/services/api/apiCache';
	import { getNotificationDisplayStart, sortNotifications } from '$lib/utils/notifications';

	type NotificationEvent = {
		id: number;
		name: string;
		description: string;
		event_type: string;
		start_time?: string | null;
		end_time?: string | null;
		created_at?: string | null;
		created_by?: { name?: string } | null;
		link?: string | null;
		done?: boolean;
	};

	let allEvents: NotificationEvent[] = [];
	let events: NotificationEvent[] = [];
	let isLoading = true;
	let requested = false;

	async function fetchNotifications() {
		const userId = $user?.id;
		if (!userId) return;
		if (requested) return;
		requested = true;

		isLoading = true;
		const url = `/api/notifications?user_id=${userId}`;
		const { cached, fresh } = cacheFirstJson<NotificationEvent[]>(fetch, url);

		if (cached) {
			const all = sortNotifications(cached.filter((e) => !e.done));
			allEvents = all;
			events = allEvents.slice(0, 3);
			isLoading = false;
		}

		fresh
			.then((all) => {
				allEvents = sortNotifications(all.filter((e) => !e.done));
				events = allEvents.slice(0, 3);
			})
			.catch(() => {})
			.finally(() => {
				isLoading = false;
			});
	}

	$: $user;
	onMount(fetchNotifications);

	async function markAsDone(eventId: number) {
		const userId = $user?.id;
		if (!userId) return;

		try {
			const res = await fetch('/api/notifications', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ event_id: eventId, user_id: userId })
			});

			if (!res.ok) throw new Error('Kunde inte uppdatera notifikationen');

			allEvents = allEvents.filter((event) => event.id !== eventId);
			events = allEvents.slice(0, 3);

			invalidateByPrefix('/api/notifications');
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Markerad som klar',
				description: 'Notifikationen är markerad som klar.'
			});

			notificationStore.updateFromServer(userId);
		} catch (err) {
			const description = err instanceof Error ? err.message : 'Något gick fel.';
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid uppdatering',
				description
			});
		}
	}

	function relativeTime(iso?: string | null): string {
		if (!iso) return '';

		const diff = Date.now() - new Date(iso).getTime();
		const minutes = Math.floor(diff / 60000);
		if (minutes < 1) return 'just nu';
		if (minutes < 60) return `${minutes} min sen`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours} h sen`;
		const days = Math.floor(hours / 24);
		return `${days} dgr sen`;
	}
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-md">
	<div class="mb-3 flex items-center gap-2">
		<div class="bg-text flex h-6 w-6 items-center justify-center rounded-full text-white">
			<Icon icon="Notification" size="14px" />
		</div>
		<h3 class="text-text text-lg font-semibold">Notifikationer</h3>
	</div>

	{#if isLoading}
		<p class="text-sm text-gray-500">Laddar...</p>
	{:else if events.length === 0}
		<p class="text-sm text-gray-500">Inga aktiva just nu.</p>
	{:else}
		<div class="flex flex-col gap-2">
			{#each events as event (event.id)}
				<NotificationCard
					title={event.name}
					message={event.description}
					timeAgo={relativeTime(getNotificationDisplayStart(event))}
					type={event.event_type}
					startTime={getNotificationDisplayStart(event)}
					endTime={event.end_time}
					createdBy={event.created_by?.name}
					link={event.link}
					linkLabel={event.link?.startsWith('/news') ? 'Läs hela artikeln' : 'Öppna'}
					on:done={() => markAsDone(event.id)}
					small
				/>
			{/each}
		</div>
	{/if}

	<!-- Link to full page -->
	<div class="mt-3 text-right">
		<a
			class="hover:text-primary-dark text-primary cursor-pointer text-sm underline"
			href="/notifications"
		>
			Visa alla
		</a>
	</div>
</div>
