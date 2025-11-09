<script lang="ts">
	import { user as userStore } from '$lib/stores/userStore';
	import { getGreeting, type Greeting } from '$lib/utils/greetings';

	let greeting: Greeting = { message: 'Hej!', icon: '👋' };
	let name: string | null = null;

	$: {
		const currentUser = $userStore;
		if (currentUser) {
			name = currentUser.firstname ?? null;
			greeting = getGreeting();
		}
	}
</script>

<div class="glass flex h-[75px] w-full items-center rounded-sm px-4">
	<div class="flex flex-col text-white">
		<span class="text-xl font-light">
			{greeting.message}
			{greeting.icon ?? ''}
		</span>
	</div>
</div>
