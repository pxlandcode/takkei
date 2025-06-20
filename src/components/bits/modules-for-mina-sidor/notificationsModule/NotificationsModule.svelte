<script lang="ts">
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/userStore';
	import { notificationStore } from '$lib/stores/notificationStore';
	import { goto } from '$app/navigation';
	import Icon from '../../icon-component/Icon.svelte';
	import NotificationCard from '../../notificationCard/NotificationCard.svelte';

	let events = [];
	let isLoading = true;

	async function fetchNotifications() {
		if (!$user?.id) return;

		isLoading = true;
		try {
			const res = await fetch(`/api/notifications?user_id=${$user.id}`);
			if (res.ok) {
				const all = await res.json();
				events = all
					.filter((e) => !e.done)
					.sort((a, b) => {
						if (a.event_type === 'alert' && b.event_type !== 'alert') return -1;
						if (a.event_type !== 'alert' && b.event_type === 'alert') return 1;
						return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
					})
					.slice(0, 3); // Limit to 3
			}
		} finally {
			isLoading = false;
		}
	}

	$: $user;
	onMount(fetchNotifications);

	function relativeTime(iso: string): string {
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

<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-md">
	<div class="mb-3 flex items-center gap-2">
		<div class="flex h-6 w-6 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="Notification" size="14px" />
		</div>
		<h3 class="text-lg font-semibold text-text">Notifikationer</h3>
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
					timeAgo={relativeTime(event.start_time)}
					type={event.event_type}
					startTime={event.start_time}
					endTime={event.end_time}
					createdBy={event.created_by?.name}
					small
				/>
			{/each}
		</div>
	{/if}

	<!-- Link to full page -->
	<div class="mt-3 text-right">
		<a
			class="hover:text-primary-dark cursor-pointer text-sm text-primary underline"
			on:click={() => goto('/notifications')}
		>
			Visa alla
		</a>
	</div>
</div>
