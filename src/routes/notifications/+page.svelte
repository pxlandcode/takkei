<script lang="ts">
	import { onMount } from 'svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import { user } from '$lib/stores/userStore';
	import NotificationCard from '../../components/bits/notificationCard/NotificationCard.svelte';
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import Checkbox from '../../components/bits/checkbox/Checkbox.svelte';
	import { notificationStore } from '$lib/stores/notificationStore';
	import { invalidateByPrefix, wrapFetch } from '$lib/services/api/apiCache';
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
	};

	$: $user;

	let events: NotificationEvent[] = [];
	let selected = new Set<number>();
	let isLoading = true;
	let isBulkMarking = false;
	const fetchWithCache = wrapFetch(fetch);

	$: allSelected = events.length > 0 && selected.size === events.length;
	$: someSelected = selected.size > 0;

	function toggleSelect(id: number) {
		if (selected.has(id)) {
			selected.delete(id);
		} else {
			selected.add(id);
		}
		selected = selected;
	}

	function toggleSelectAll() {
		if (allSelected) {
			selected = new Set();
		} else {
			selected = new Set(events.map((e) => e.id));
		}
	}

	function getErrorMessage(error: unknown) {
		return error instanceof Error ? error.message : 'Något gick fel.';
	}

	async function fetchNotifications() {
		const userId = $user?.id;
		if (!userId) return;

		isLoading = true;
		try {
			const res = await fetchWithCache(`/api/notifications?user_id=${userId}`);
			if (!res.ok) throw new Error('Kunde inte hämta notifikationer');
			const all = (await res.json()) as NotificationEvent[];
			events = sortNotifications(all);
		} catch (err) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid hämtning',
				description: getErrorMessage(err)
			});
		} finally {
			isLoading = false;
		}
	}

	async function markAsDone(eventId: number) {
		const userId = $user?.id;
		if (!userId) return;

		try {
			await fetch('/api/notifications', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ event_id: eventId, user_id: userId })
			});
			events = events.filter((e) => e.id !== eventId);
			selected.delete(eventId);
			selected = selected;
			invalidateByPrefix('/api/notifications');

			addToast({
				type: AppToastType.SUCCESS,
				message: 'Markerad som klar',
				description: 'Notifikationen är markerad som klar.'
			});
			notificationStore.updateFromServer(userId);
		} catch (err) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid uppdatering',
				description: getErrorMessage(err)
			});
		}
	}

	async function markMultipleAsDone(eventIds: number[]) {
		if (!eventIds.length) return;
		const userId = $user?.id;
		if (!userId) return;
		isBulkMarking = true;

		try {
			await fetch('/api/notifications', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ event_ids: eventIds, user_id: userId })
			});

			const removedSet = new Set(eventIds);
			events = events.filter((e) => !removedSet.has(e.id));
			selected = new Set();
			invalidateByPrefix('/api/notifications');

			addToast({
				type: AppToastType.SUCCESS,
				message: `${eventIds.length} markerade som klara`,
				description: 'Notifikationerna är markerade som klara.'
			});
			notificationStore.updateFromServer(userId);
		} catch (err) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid uppdatering',
				description: getErrorMessage(err)
			});
		} finally {
			isBulkMarking = false;
		}
	}

	function markSelectedAsDone() {
		markMultipleAsDone([...selected]);
	}

	function markAllAsDone() {
		markMultipleAsDone(events.map((e) => e.id));
	}

	onMount(fetchNotifications);

	function relativeTime(iso?: string | null): string {
		if (!iso) return '';

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
		<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
			<Icon icon="Notification" size="18px" />
		</div>
		<h2 class="text-text text-3xl font-semibold">Dina Notifikationer</h2>
	</div>
	{#if !isLoading && events.length > 0}
		<div class="flex items-center gap-2">
			{#if someSelected}
				<button
					class="bg-success hover:bg-success-hover rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
					disabled={isBulkMarking}
					on:click={markSelectedAsDone}
				>
					Markera valda ({selected.size}) som klara
				</button>
			{/if}
			<button
				class="bg-text rounded-md px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
				disabled={isBulkMarking}
				on:click={markAllAsDone}
			>
				Markera alla som klara
			</button>
		</div>
	{/if}
</div>

{#if isLoading}
	<p class="text-gray-500">Laddar notifikationer...</p>
{:else if events.length === 0}
	<p class="text-gray-500">Du har inga aktiva notifikationer.</p>
{:else}
	<div class="max-h-[80vh] overflow-y-auto px-4">
		<div class="mb-2 px-2">
			<Checkbox
				id="select-all"
				label="Välj alla"
				checked={allSelected}
				on:change={toggleSelectAll}
			/>
		</div>
		<div class="flex flex-col items-center">
			{#each events as event (event.id)}
				<div class="flex w-full items-start gap-2 p-2">
					<div class="mt-3 flex-shrink-0">
						<Checkbox
							id="notification-{event.id}"
							checked={selected.has(event.id)}
							on:change={() => toggleSelect(event.id)}
						/>
					</div>
					<div class="flex-1">
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
						/>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
