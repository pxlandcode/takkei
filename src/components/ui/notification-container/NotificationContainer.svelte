<script lang="ts">
	import { notifications, removeNotification } from '$lib/stores/notificationStore';

	import Notification from '../notification/Notification.svelte';
</script>

<div class="fixed right-4 top-4 z-[9999] flex flex-col-reverse items-end gap-2 space-y-2">
	{#each $notifications as { id, type, message, description } (id)}
		<Notification {id} {type} {message} {description} on:close={() => removeNotification(id)} />
	{/each}
</div>
