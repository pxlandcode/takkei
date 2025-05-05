<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { sendMail } from '$lib/services/mail/mailClientService';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { clients, fetchClients } from '$lib/stores/clientsStore';
	import { loadingStore } from '$lib/stores/loading';

	import QuillEditor from '../../bits/quillEditor/QuillEditor.svelte';
	import DropdownCheckbox from '../../bits/dropdown-checkbox/DropdownCheckbox.svelte';
	import FilterBox from '../../bits/filterBox/FilterBox.svelte';
	import Button from '../../bits/button/Button.svelte';
	import Input from '../../bits/Input/Input.svelte';
	import { addNotification } from '$lib/stores/notificationStore';
	import { AppNotificationType } from '$lib/types/notificationTypes';

	let subject = '';
	let header = '';
	let subheader = '';
	let body = '';
	let emailInput = '';
	let manualEmails: string[] = [];

	let selectedUsers = [];

	let selectedClients = [];

	$: isLoading = $loadingStore.isLoading;

	onMount(async () => {
		await Promise.all([fetchUsers(), fetchClients()]);
	});

	// Selection handlers
	function handleUserSelection(event) {
		selectedUsers = [...event.detail.selected];
	}

	function onSelectAllUsers() {
		selectedUsers = get(users);
	}

	function onDeSelectAllUsers() {
		selectedUsers = [];
	}

	function handleClientSelection(event) {
		selectedClients = [...event.detail.selected];
	}
	function onSelectAllClients() {
		selectedClients = get(clients);
	}
	function onDeSelectAllClients() {
		selectedClients = [];
	}

	// Manual email input
	function addEmail() {
		const cleaned = emailInput.trim();
		if (cleaned && !manualEmails.includes(cleaned)) {
			manualEmails = [...manualEmails, cleaned];
			emailInput = '';
		}
	}

	function removeEmail(email: string) {
		manualEmails = manualEmails.filter((e) => e !== email);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addEmail();
		}
	}

	// Send mail
	async function handleSend() {
		loadingStore.loading(true, 'Skickar mail...');

		const recipients = [
			...manualEmails,
			...selectedUsers.map((u) => u.email),
			...selectedClients.map((c) => c.email)
		];

		try {
			await sendMail({
				to: recipients,
				subject,
				header,
				subheader,
				body
			});

			addNotification({
				type: AppNotificationType.SUCCESS,
				message: 'Mail skickat',
				description: `Mailet skickades till ${recipients.length} mottagare.`
			});

			// 🔁 Reset form state
			subject = '';
			header = '';
			subheader = '';
			body = '';
			emailInput = '';
			manualEmails = [];
			selectedUsers = [];
			selectedClients = [];

			loadingStore.loading(false);
		} catch (e) {
			console.error(e);
			loadingStore.loading(false);
			addNotification({
				type: AppNotificationType.CANCEL,
				message: 'Fel vid utskick',
				description: `Ett fel inträffade vid utskick av mailet.`
			});
		}
	}
</script>

<div class="flex flex-col gap-4">
	<!-- Subject -->

	<Input
		label="Ämne"
		name="subject"
		bind:value={subject}
		placeholder="Nyhetsbrev, uppdatering..."
	/>

	<!-- Header + Subheader row -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<Input
			label="Rubrik"
			name="header"
			bind:value={header}
			placeholder="Huvudrubrik som syns i mailet..."
		/>
		<Input
			label="Underrubrik"
			name="subheader"
			bind:value={subheader}
			placeholder="Kort förklaring"
		/>
	</div>

	<!-- Manual email entry -->

	<div class="flex items-center gap-2">
		<Input
			label="Lägg till mailadresser manuellt"
			name="email"
			placeholder="mail@example.com"
			bind:value={emailInput}
			on:enter={addEmail}
		/>

		<div class="mt-1 flex flex-row gap-2">
			<Button icon="Plus" variant="secondary" iconSize="14" on:click={addEmail} />
		</div>
	</div>

	<!-- Users -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="flex flex-row gap-2">
			<DropdownCheckbox
				label="Användare"
				placeholder="Välj användare"
				id="users"
				options={($users || []).map((user) => ({
					name: `${user.firstname} ${user.lastname}`,
					value: user
				}))}
				bind:selectedValues={selectedUsers}
				on:change={handleUserSelection}
				search
				maxNumberOfSuggestions={10}
				infiniteScroll
			/>
			<div class="mt-6 flex flex-row gap-2">
				<Button
					icon="MultiCheck"
					iconColor="green"
					variant="secondary"
					on:click={onSelectAllUsers}
				/>
				<Button icon="Trash" iconColor="red" variant="secondary" on:click={onDeSelectAllUsers} />
			</div>
		</div>

		<div class="flex flex-row gap-2">
			<DropdownCheckbox
				label="Kunder"
				placeholder="Välj kunder"
				id="clients"
				options={($clients || []).map((client) => ({
					name: `${client.firstname} ${client.lastname}`,
					value: client
				}))}
				bind:selectedValues={selectedClients}
				on:change={handleClientSelection}
				search
				maxNumberOfSuggestions={10}
				infiniteScroll
			/>
			<div class="mt-6 flex flex-row gap-2">
				<Button
					icon="MultiCheck"
					iconColor="green"
					variant="secondary"
					on:click={onSelectAllClients}
				/>
				<Button icon="Trash" iconColor="red" variant="secondary" on:click={onDeSelectAllClients} />
			</div>
		</div>
	</div>
	<!-- Filter summary -->
	<FilterBox
		title="Mottagare"
		{selectedUsers}
		{selectedClients}
		selectedEmails={manualEmails}
		on:removeFilter={(event) => {
			const { type, id } = event.detail;
			if (type === 'trainer') selectedUsers = selectedUsers.filter((u) => u.id !== id);
			if (type === 'client') selectedClients = selectedClients.filter((c) => c.id !== id);
			if (type === 'email') manualEmails = manualEmails.filter((e) => e !== id);
		}}
	/>

	<!-- QuillEditor -->
	<div>
		<label class="mb-1 block text-sm font-semibold text-gray-600">Meddelande</label>
		<QuillEditor
			content={body}
			placeholder="Skriv ditt utskick här..."
			on:change={(e) => (body = e.detail)}
		/>
	</div>

	<!-- Send button -->
	<div class="pt-4">
		<Button
			text={isLoading ? 'Skickar...' : 'Skicka mail'}
			iconRight="Send"
			iconRightSize="18"
			variant="primary"
			full
			on:click={handleSend}
			disabled={isLoading}
		/>
	</div>
</div>

<style>
</style>
