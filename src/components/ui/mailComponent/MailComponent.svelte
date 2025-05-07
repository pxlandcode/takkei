<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { sendMail } from '$lib/services/mail/mailClientService';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { clients, fetchClients } from '$lib/stores/clientsStore';
	import { loadingStore } from '$lib/stores/loading';
	import { user } from '$lib/stores/userStore';

	import QuillEditor from '../../bits/quillEditor/QuillEditor.svelte';
	import DropdownCheckbox from '../../bits/dropdown-checkbox/DropdownCheckbox.svelte';
	import FilterBox from '../../bits/filterBox/FilterBox.svelte';
	import Button from '../../bits/button/Button.svelte';
	import Input from '../../bits/Input/Input.svelte';
	import OptionButton from '../../bits/optionButton/OptionButton.svelte';
	import { addNotification } from '$lib/stores/notificationStore';
	import { AppNotificationType } from '$lib/types/notificationTypes';

	export let autoFetchUsersAndClients: boolean = true;

	export let prefilledRecipients: string[] = [];
	export let prefilledFrom: string | null = null;
	export let subject: string = '';
	export let header: string = '';
	export let subheader: string = '';
	export let body: string = '';
	export let lockedFields: string[] = [];

	let emailInput = '';
	let manualEmails: string[] = [...prefilledRecipients];
	let selectedUsers = [];
	let selectedClients = [];

	$: isLoading = $loadingStore.isLoading;

	let selectedFromOption;
	$: fromOptions = [
		{
			label: 'Min e-post',
			value: { name: $user?.firstname, email: $user?.email || 'info@takkei.se' }
		},
		{ label: 'info@takkei.se', value: { name: 'Takkei', email: 'info@takkei.se' } }
	];

	$: selectedFromOption = selectedFromOption || fromOptions[0]; // fallback if not set

	onMount(async () => {
		if (autoFetchUsersAndClients) {
			await Promise.all([fetchUsers(), fetchClients()]);
		}
	});

	function handleUserSelection(event) {
		selectedUsers = [...event.detail.selected];
	}
	function handleClientSelection(event) {
		selectedClients = [...event.detail.selected];
	}
	function onSelectAllUsers() {
		selectedUsers = get(users);
	}
	function onDeSelectAllUsers() {
		selectedUsers = [];
	}
	function onSelectAllClients() {
		selectedClients = get(clients);
	}
	function onDeSelectAllClients() {
		selectedClients = [];
	}
	function addEmail() {
		const cleaned = emailInput.trim();
		if (cleaned && !manualEmails.includes(cleaned)) {
			manualEmails = [...manualEmails, cleaned];
			emailInput = '';
		}
	}
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addEmail();
		}
	}

	async function handleSend() {
		loadingStore.loading(true, 'Skickar mail...');
		const recipients = [
			...manualEmails,
			...selectedUsers.map((u) => u.email),
			...selectedClients.map((c) => c.email)
		];
		try {
			console.log('from', selectedFromOption.value);
			await sendMail({
				to: recipients,
				subject,
				header,
				subheader,
				body,
				from: selectedFromOption.value
			});

			addNotification({
				type: AppNotificationType.SUCCESS,
				message: 'Mail skickat',
				description: `Mailet skickades till ${recipients.length} mottagare.`
			});

			subject = '';
			header = '';
			subheader = '';
			body = '';
			emailInput = '';
			manualEmails = [];
			selectedUsers = [];
			selectedClients = [];
		} catch (e) {
			console.error(e);
			addNotification({
				type: AppNotificationType.CANCEL,
				message: 'Fel vid utskick',
				description: 'Ett fel inträffade vid utskick av mailet.'
			});
		} finally {
			loadingStore.loading(false);
		}
	}
</script>

<div class="flex flex-col gap-4">
	{#if !lockedFields.includes('subject')}
		<Input
			label="Ämne"
			name="subject"
			bind:value={subject}
			placeholder="Nyhetsbrev, uppdatering..."
		/>
	{:else}
		<p><strong>Ämne:</strong> {subject}</p>
	{/if}

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		{#if !lockedFields.includes('header')}
			<Input
				label="Rubrik"
				name="header"
				bind:value={header}
				placeholder="Huvudrubrik som syns i mailet..."
			/>
		{:else}
			<p><strong>Rubrik:</strong> {header}</p>
		{/if}

		{#if !lockedFields.includes('subheader')}
			<Input
				label="Underrubrik"
				name="subheader"
				bind:value={subheader}
				placeholder="Kort förklaring"
			/>
		{:else}
			<p><strong>Underrubrik:</strong> {subheader}</p>
		{/if}
	</div>

	{#if !lockedFields.includes('recipients')}
		<div class="flex items-center gap-2">
			<Input
				label="Lägg till mailadresser manuellt"
				name="email"
				placeholder="mail@example.com"
				bind:value={emailInput}
				on:keydown={handleKeyDown}
			/>
			<div class="mt-1 flex flex-row gap-2">
				<Button icon="Plus" variant="secondary" iconSize="14" on:click={addEmail} />
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
			<div class="flex flex-row gap-2">
				<DropdownCheckbox
					label="Tränare"
					placeholder="Välj tränare"
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
					<Button
						icon="Trash"
						iconColor="red"
						variant="secondary"
						on:click={onDeSelectAllClients}
					/>
				</div>
			</div>
		</div>

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
	{/if}

	<div>
		<label class="mb-1 block text-sm font-semibold text-gray-600">Meddelande</label>
		<QuillEditor
			content={body}
			placeholder="Skriv ditt utskick här..."
			on:change={(e) => (body = e.detail)}
		/>
	</div>

	{#if !lockedFields.includes('from')}
		<div class="pt-4">
			<label class="mb-2 block text-sm font-semibold text-gray-600">Skicka från</label>
			<OptionButton
				options={fromOptions}
				bind:selectedOption={selectedFromOption}
				full
				size="small"
			/>
		</div>
	{:else}
		<p><strong>Från:</strong> {selectedFromOption.label} ({selectedFromOption.value})</p>
	{/if}

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
