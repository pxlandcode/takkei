<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly } from 'svelte/transition';
	import IconButton from '../../bits/icon-button/IconButton.svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';

	export let id: string;
	export let type: 'success' | 'cancel' | 'note' = 'note';
	export let message: string = '';
	export let description: string = '';

	const dispatch = createEventDispatcher();

	function close() {
		dispatch('close', id);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			close();
		}
	}
</script>

<div
	class={`relative mb-2 flex w-80 cursor-pointer items-start gap-2 rounded-lg border px-4 py-2 shadow-md transition-transform  ${type === 'success' ? 'bg-green-bright border-green-dark' : type === 'cancel' ? 'border-red-dark bg-red' : 'border-blue-950 bg-blue-500'} text-white`}
	transition:fly={{ x: -300, duration: 400 }}
	role="alert"
>
	<div class="flex-1">
		<div class="flex items-center gap-2">
			{#if type === 'success'}
				<Icon icon="CircleCheck" size="14px" />
			{:else if type === 'cancel'}
				<Icon icon="CircleCross" size="14px" />
			{:else if type === 'note'}
				<Icon icon="Notification" size="14px" />
			{/if}
			<p class="text-sm font-semibold">{message}</p>
		</div>
		<p class="text-xs">{description}</p>
	</div>

	<div class="absolute right-2 top-2">
		<IconButton small icon="Close" size="10px" transparent on:click={close} />
	</div>
</div>
