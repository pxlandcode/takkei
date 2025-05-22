<script lang="ts">
	import Button from '../../bits/button/Button.svelte';

	import PopupWrapper from '../../ui/popupWrapper/PopupWrapper.svelte';
	import NotificationCreator from '../../ui/notificationCreator/NotificationCreator.svelte';
	import NotificationAdminList from '../notificationAdminList/NotificationAdminList.svelte';

	let showAddModal = false;

	let refreshKey = 0;

	function closePopup() {
		showAddModal = false;
	}

	function handleCreated() {
		showAddModal = false;
		refreshKey++;
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
			on:click={() => (showAddModal = true)}
		/>
	</div>

	<NotificationAdminList {refreshKey} />

	{#if showAddModal}
		<PopupWrapper header="Ny notifikation" icon="Notification" on:close={closePopup}>
			<NotificationCreator on:created={handleCreated} />
		</PopupWrapper>
	{/if}
</div>
