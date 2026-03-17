<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import { cacheFirstJson, invalidateByPrefix } from '$lib/services/api/apiCache';
	import { notificationStore } from '$lib/stores/notificationStore';
	import { addToast } from '$lib/stores/toastStore';
	import { user } from '$lib/stores/userStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import HomeModernNotificationRow from './HomeModernNotificationRow.svelte';
	import { sortNotificationEvents } from './homeModernUtils';
	import type { HomeModernNotificationEvent } from './homeModernTypes';

	let mounted = false;
	let allEvents: HomeModernNotificationEvent[] = [];
	let events: HomeModernNotificationEvent[] = [];
	let notificationsLoading = true;
	let notificationsUserId: number | null = null;
	let markingDoneId: number | null = null;
	let dismissTimeoutId: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		mounted = true;

		if ($user?.id) {
			notificationsUserId = $user.id;
			void fetchNotifications();
		} else {
			notificationsLoading = false;
		}

		return () => {
			if (dismissTimeoutId) {
				clearTimeout(dismissTimeoutId);
			}
		};
	});

	$: if (mounted && $user?.id && $user.id !== notificationsUserId) {
		notificationsUserId = $user.id;
		void fetchNotifications();
	}

	$: if (mounted && !$user?.id && notificationsUserId !== null) {
		notificationsUserId = null;
		allEvents = [];
		events = [];
		notificationsLoading = false;
	}

	function setVisibleNotificationEvents(nextEvents: HomeModernNotificationEvent[]) {
		events = nextEvents;
	}

	async function fetchNotifications() {
		if (!$user?.id) return;

		notificationsLoading = true;

		const url = `/api/notifications?user_id=${$user.id}`;
		const { cached, fresh } = cacheFirstJson<HomeModernNotificationEvent[]>(fetch, url);

		if (cached) {
			allEvents = sortNotificationEvents(cached.filter((event) => !event.done));
			setVisibleNotificationEvents(allEvents.slice(0, 3));
			notificationsLoading = false;
		}

		fresh
			.then((nextEvents) => {
				allEvents = sortNotificationEvents(nextEvents.filter((event) => !event.done));
				setVisibleNotificationEvents(allEvents.slice(0, 3));
			})
			.catch((error) => {
				console.error('Failed to load notifications', error);
			})
			.finally(() => {
				notificationsLoading = false;
			});
	}

	async function markNotificationDone(eventId: number) {
		if (markingDoneId === eventId) {
			if (dismissTimeoutId) {
				clearTimeout(dismissTimeoutId);
				dismissTimeoutId = null;
			}
			removeNotification(eventId);
			return;
		}

		markingDoneId = eventId;

		try {
			const response = await fetch('/api/notifications', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ event_id: eventId, user_id: $user?.id })
			});

			if (!response.ok) {
				throw new Error('Kunde inte uppdatera');
			}

			dismissTimeoutId = setTimeout(() => {
				removeNotification(eventId);
			}, 300);
		} catch (error) {
			markingDoneId = null;
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid uppdatering',
				description: error instanceof Error ? error.message : 'Något gick fel.'
			});
		}
	}

	function removeNotification(eventId: number) {
		allEvents = allEvents.filter((event) => event.id !== eventId);
		setVisibleNotificationEvents(allEvents.slice(0, 3));
		invalidateByPrefix('/api/notifications');
		if ($user?.id) {
			void notificationStore.updateFromServer($user.id);
		}
		markingDoneId = null;
		dismissTimeoutId = null;
	}
</script>

{#if !notificationsLoading && events.length > 0}
	<section class="bg-white p-4 shadow-sm">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="flex items-center gap-2 text-lg font-semibold text-gray-900">
				<Icon icon="Notification" size="18px" color="primary" />
				Notiser
				<span class="bg-red/10 text-red px-1.5 py-0.5 text-xs font-medium">
					{allEvents.length}
				</span>
			</h2>
			<a href="/notifications" class="text-primary text-sm font-medium hover:underline">
				Visa alla →
			</a>
		</div>
		<div class="divide-y divide-gray-100">
			{#each events as event (event.id)}
				<HomeModernNotificationRow
					{event}
					isMarking={markingDoneId === event.id}
					on:done={({ detail }) => markNotificationDone(detail.id)}
				/>
			{/each}
		</div>
	</section>
{/if}
