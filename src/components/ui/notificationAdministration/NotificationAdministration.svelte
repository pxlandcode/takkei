<script lang="ts">
	import Button from '../../bits/button/Button.svelte';

import NotificationCreator from '../../ui/notificationCreator/NotificationCreator.svelte';
import NotificationAdminList from '../notificationAdminList/NotificationAdminList.svelte';
import { openPopup } from '$lib/stores/popupStore';

let refreshKey = 0;

function handleCreated() {
	refreshKey++;
}

function openNotificationPopup() {
	openPopup({
		header: 'Ny notifikation',
		icon: 'Notification',
		component: NotificationCreator,
		listeners: {
			created: () => {
				handleCreated();
			}
		},
		closeOn: ['created']
	});
}
</script>

<div class="h-full overflow-x-scroll custom-scrollbar">
	<div class="mb-4 flex flex-row items-center justify-between">
		<h2 class="text-xl font-semibold">Notifikationer</h2>
	</div>

	<div class="mb-4 flex flex-row items-center justify-between">
		<p class="text-sm text-gray-500">Mina skapta notifikationer</p>
		<Button
			text="Skapa ny notifikation"
			icon="Plus"
			variant="primary"
			on:click={openNotificationPopup}
		/>
	</div>

	<NotificationAdminList {refreshKey} />

<!-- Popups handled via global store -->
</div>
