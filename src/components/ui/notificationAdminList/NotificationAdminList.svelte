<script lang="ts">
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/userStore';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import NotificationAdminCard from '../../bits/notificationAdminCard/NotificationAdminCard.svelte';

	export let refreshKey = 0;

	let sentNotifications = [];
	let expanded = new Set<number>();
	let offset = 0;
	let limit = 10;
	let loading = false;
	let allLoaded = false;

	$: $user;

	onMount(loadMore);

	$: if (refreshKey) {
		resetAndFetch();
	}

	async function loadMore() {
		if (loading || allLoaded || !$user?.id) return;
		loading = true;

		try {
			const res = await fetch(
				`/api/notifications/sent?user_id=${$user.id}&offset=${offset}&limit=${limit}`
			);
			if (!res.ok) throw new Error('Serverfel');

			const data = await res.json();
			if (data.length < limit) allLoaded = true;

			sentNotifications = [...sentNotifications, ...data];
			offset += limit;
		} catch (err) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte hämta notifikationer',
				description: err.message
			});
		} finally {
			loading = false;
		}
	}

	function resetAndFetch() {
		offset = 0;
		allLoaded = false;
		sentNotifications = [];
		loadMore();
	}

	async function handleDelete(id: number) {
		try {
			const res = await fetch(`/api/notifications/${id}`, {
				method: 'DELETE'
			});

			if (!res.ok) throw new Error('Kunde inte radera notifikationen');

			sentNotifications = sentNotifications.filter((n) => n.id !== id);

			addToast({
				type: AppToastType.SUCCESS,
				message: 'Notifikationen raderades',
				description: ''
			});
		} catch (err) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid radering',
				description: err.message
			});
		}
	}
</script>

<div class="space-y-4">
	{#each sentNotifications as notif (notif.id)}
		<NotificationAdminCard
			title={notif.name}
			message={notif.description}
			startTime={notif.start_time}
			endTime={notif.end_time}
			eventType={notif.event_type}
			timeAgo={new Date(notif.created_at).toLocaleDateString('sv-SE')}
			link={notif.link}
			doneCount={notif.marked_done}
			totalCount={notif.total_receivers}
			recipients={notif.recipients || []}
			on:delete={() => handleDelete(notif.id)}
		/>
	{/each}
</div>
