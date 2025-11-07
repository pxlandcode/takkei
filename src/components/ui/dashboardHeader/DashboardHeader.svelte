<script lang="ts">
	import { user } from '$lib/stores/userStore';
	import type { User } from '$lib/types/userTypes';
	import { getGreeting, type Greeting } from '$lib/utils/greetings';
	import { onMount } from 'svelte';
	import Button from '../../bits/button/Button.svelte';
	import BookingPopup from '../bookingPopup/BookingPopup.svelte';
	import { goto } from '$app/navigation';
	import { notificationStore } from '$lib/stores/notificationStore';
	import { openPopup } from '$lib/stores/popupStore';

	let currentUser: User | null = null;

	let greeting: Greeting = { message: 'Hej!', icon: '👋' };
	$: totalNotifications = $notificationStore.total;

	user.subscribe((value) => {
		currentUser = value;

		if (currentUser) {
			greeting = getGreeting();
		}
	});

	onMount(() => {
		if (currentUser) {
			greeting = getGreeting();
		}
	});

	function openBookingPopup(initialStartTime: Date | null = null) {
		openPopup({
			header: 'Bokning',
			icon: 'Plus',
			component: BookingPopup,
			maxWidth: '650px',
			props: { startTime: initialStartTime }
		});
	}

	const handleBookingButtonClick = () => {
		openBookingPopup(null);
	};
</script>

<div class="glass flex h-[75px] w-full items-center justify-between rounded-lg px-4">
	<div class="text-xl font-light text-white">
		{greeting.message}
		{greeting.icon ? greeting.icon : ''}
	</div>

	<div class="flex items-center gap-2">
		<Button icon="Plus" variant="primary" iconSize="14" on:click={handleBookingButtonClick}
		></Button>

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
</div>
