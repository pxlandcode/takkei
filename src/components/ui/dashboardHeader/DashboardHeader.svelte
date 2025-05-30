<script lang="ts">
	import { user } from '$lib/stores/userStore';
	import type { User } from '$lib/types/userTypes';
	import { getGreeting, type Greeting } from '$lib/utils/greetings';
	import { onMount } from 'svelte';
	import Button from '../../bits/button/Button.svelte';
	import { goto } from '$app/navigation';
	import { notificationStore } from '$lib/stores/notificationStore';

	let currentUser: User | null = null;

	let greeting: Greeting = { message: 'Hej!', icon: '👋' };
	$: totalNotifications = $notificationStore.total;

	user.subscribe((value) => {
		currentUser = value;
	});

	onMount(() => {
		if (currentUser) {
			greeting = getGreeting(currentUser);
		}
	});
</script>

<div class="flex h-[75px] w-full items-center justify-between rounded-lg px-4 glass">
	<div class="text-2xl text-white">
		{greeting.message}
		{greeting.icon ? greeting.icon : ''}
	</div>

	<div class="relative">
		<Button
			icon="Notification"
			variant="secondary"
			on:click={() => {
				goto('/notifications');
			}}
			notificationCount={totalNotifications}
		></Button>
	</div>
</div>
