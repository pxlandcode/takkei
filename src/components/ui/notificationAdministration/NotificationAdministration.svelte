<script lang="ts">
	import NotificationCreator from '$lib/components/NotificationCreator.svelte';
	import { user } from '$lib/stores/userStore';
	import { onMount } from 'svelte';
	import PopupWrapper from '$lib/components/ui/PopupWrapper.svelte';
	import Icon from '$lib/components/bits/icon-component/Icon.svelte';

	let showPopup = false;
	let sentNotifications = [];
	let expanded = new Set<number>();
	let selectedNotification = null;

	async function fetchSentNotifications() {
		const res = await fetch(`/api/notifications/sent?user_id=${$user.id}`);
		sentNotifications = await res.json();
	}

	async function fetchDoneStatuses(notificationId: number) {
		const res = await fetch(`/api/notifications/${notificationId}/done`);
		const data = await res.json();
		selectedNotification = { ...data.notification, recipients: data.recipients };
	}

	function toggleExpand(id: number) {
		if (expanded.has(id)) {
			expanded.delete(id);
		} else {
			expanded.add(id);
			fetchDoneStatuses(id);
		}
	}
</script>

<h1 class="mb-4 text-2xl font-semibold">Notifikationsadministration</h1>

<Button text="Skapa notifikation" icon="Plus" on:click={() => (showPopup = true)} />

{#if showPopup}
	<PopupWrapper on:close={() => (showPopup = false)}>
		<NotificationCreator
			on:created={() => {
				showPopup = false;
				fetchSentNotifications();
			}}
		/>
	</PopupWrapper>
{/if}

<div class="mt-6 space-y-4">
	{#each sentNotifications as notif (notif.id)}
		<div class="rounded border bg-white p-4 shadow-sm">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-lg font-semibold">{notif.name}</h2>
					<p class="text-sm text-gray-600">
						{notif.marked_done} av {notif.total_receivers} har markerat som klar
					</p>
				</div>
				<Button
					text={expanded.has(notif.id) ? 'Stäng' : 'Visa mottagare'}
					variant="secondary"
					small
					on:click={() => toggleExpand(notif.id)}
				/>
			</div>

			{#if expanded.has(notif.id) && selectedNotification?.id === notif.id}
				<div class="mt-3 space-y-2">
					{#each selectedNotification.recipients as r}
						<div class="flex items-center justify-between border-b py-1">
							<span>{r.firstname} {r.lastname}</span>
							<Icon
								icon={r.done ? 'CheckCircle' : 'XCircle'}
								class={r.done ? 'text-green' : 'text-error'}
								size="18"
							/>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>
