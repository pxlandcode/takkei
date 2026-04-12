<script lang="ts">
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/userStore';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import NotificationAdminCard from '../../bits/notificationAdminCard/NotificationAdminCard.svelte';
	import NotificationCreator from '../notificationCreator/NotificationCreator.svelte';
	import { openPopup } from '$lib/stores/popupStore';

	export let refreshKey = 0;

	type NotificationRecipient = {
		id: number;
		name: string;
		hasMarkedDone: boolean;
		event_id: number;
	};

	type NotificationAdminItem = {
		id: number;
		name: string;
		description: string;
		start_time?: string | null;
		end_time?: string | null;
		created_at?: string | null;
		event_type: 'client' | 'alert' | 'info' | 'article';
		event_type_id?: number | null;
		user_ids: number[];
		marked_done: number;
		total_receivers: number;
		link?: string | null;
		recipients?: NotificationRecipient[];
	};

	let sentNotifications: NotificationAdminItem[] = [];
	let offset = 0;
	let limit = 10;
	let loading = false;
	let allLoaded = false;

	$: $user;

	onMount(loadMore);

	$: if (refreshKey) {
		resetAndFetch();
	}

	function getErrorMessage(error: unknown) {
		return error instanceof Error ? error.message : 'Något gick fel.';
	}

	async function loadMore() {
		const userId = $user?.id;
		if (loading || allLoaded || !userId) return;
		loading = true;

		try {
			const res = await fetch(
				`/api/notifications/sent?user_id=${userId}&offset=${offset}&limit=${limit}`
			);
			if (!res.ok) throw new Error('Serverfel');

			const data = (await res.json()) as NotificationAdminItem[];
			if (data.length < limit) allLoaded = true;

			sentNotifications = [...sentNotifications, ...data];
			offset += limit;
		} catch (err) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte hämta notifikationer',
				description: getErrorMessage(err)
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

	function openEditPopup(notification: NotificationAdminItem) {
		openPopup({
			header: 'Ändra notifikation',
			icon: 'Edit',
			component: NotificationCreator,
			props: {
				mode: 'edit',
				notification
			},
			listeners: {
				updated: () => {
					resetAndFetch();
				}
			},
			closeOn: ['updated']
		});
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
				description: getErrorMessage(err)
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
			timeAgo={notif.created_at ? new Date(notif.created_at).toLocaleDateString('sv-SE') : ''}
			link={notif.link}
			doneCount={notif.marked_done}
			totalCount={notif.total_receivers}
			recipients={notif.recipients || []}
			on:edit={() => openEditPopup(notif)}
			on:delete={() => handleDelete(notif.id)}
		/>
	{/each}
</div>
