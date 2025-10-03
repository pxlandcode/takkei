<script lang="ts">
	import { toasts, removeToast } from '$lib/stores/toastStore';

	import Toast from '../toast/Toast.svelte';
</script>

<div class="fixed bottom-4 left-4 z-9999 flex flex-col-reverse items-end gap-2 space-y-2">
	{#each $toasts as { id, type, message, description } (id)}
		<Toast {id} {type} {message} {description} on:close={() => removeToast(id)} />
	{/each}
</div>
