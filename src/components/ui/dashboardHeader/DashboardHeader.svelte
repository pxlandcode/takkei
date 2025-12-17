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

async function loadGreeting() {
	if (!currentUser) return;
	try {
		greeting = await getGreeting({ audience: 'user' });
	} catch (error) {
		console.error('Failed to load greeting', error);
	}
}

	onMount(() => {
		const unsubscribe = user.subscribe((value) => {
			currentUser = value;
			if (currentUser) {
				void loadGreeting();
			}
		});

		return () => unsubscribe();
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

<div class="glass flex h-[75px] w-full items-center justify-between rounded-sm px-4">
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
