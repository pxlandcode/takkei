<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import DropdownCheckbox from '../../bits/dropdown-checkbox/DropdownCheckbox.svelte';
	import FilterBox from '../../bits/filterBox/FilterBox.svelte';
	import Button from '../../bits/button/Button.svelte';
	import Input from '../../bits/Input/Input.svelte';
	import TextArea from '../../bits/textarea/TextArea.svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import { user } from '$lib/stores/userStore';
	import Checkbox from '../../bits/checkbox/Checkbox.svelte';
	import InfoButton from '../../bits/infoButton/InfoButton.svelte';
	import { sendMail } from '$lib/services/mail/mailClientService';

	$: user;

	const dispatch = createEventDispatcher();

	let name = '';
	let description = '';
	let start_time = new Date().toISOString().slice(0, 16);
	let end_time = '';
	let selectedUsers = [];
	let errors: Record<string, string> = {};
	let isImportant = false;
	let sendAsEmail = false;

	onMount(async () => {
		if (get(users).length === 0) {
			await fetchUsers();
		}
	});

	function handleUserSelection(event) {
		selectedUsers = [...event.detail.selected];
	}

	function onSelectAllUsers() {
		selectedUsers = get(users);
	}

	function onDeSelectAllUsers() {
		selectedUsers = [];
	}

	function validate() {
		errors = {};
		if (!name) errors.name = 'Titel krävs';
		if (!start_time) errors.start_time = 'Starttid krävs';
		if (selectedUsers.length === 0) errors.user_ids = 'Minst en användare krävs';
		return Object.keys(errors).length === 0;
	}

	function onCreated() {
		dispatch('created');
	}

	async function submit() {
		if (!validate()) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Saknar fält',
				description: 'Fyll i alla obligatoriska fält.'
			});
			return;
		}

		const user_ids = selectedUsers.map((u) => u.id);

		try {
			const res = await fetch('/api/notifications', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					description,
					start_time,
					end_time: end_time || null,
					user_ids,
					created_by: $user?.id,
					event_type_id: isImportant ? 2 : null
				})
			});

			if (!res.ok) throw new Error((await res.json()).error || 'Fel vid skapande');
			const created = await res.json();

			addToast({
				type: AppToastType.SUCCESS,
				message: 'Notifikation skapad!',
				description: `Notifikationen "${created.name}" skapades för ${user_ids.length} användare.`
			});

			if (sendAsEmail) {
				try {
					await sendMail({
						to: selectedUsers.map((u) => u.email),
						subject: name,
						header: name,
						subheader: `Gäller: ${new Date(start_time).toLocaleDateString('sv-SE')}`,
						body: description || 'Ingen beskrivning angiven.'
					});
					addToast({
						type: AppToastType.SUCCESS,
						message: 'E-post skickat',
						description: 'Notifikationen skickades också som mail.'
					});
				} catch (emailErr) {
					addToast({
						type: AppToastType.CANCEL,
						message: 'Kunde inte skicka e-post',
						description: emailErr.message
					});
				}
			}

			name = '';
			description = '';
			start_time = new Date().toISOString().slice(0, 16);
			end_time = '';
			selectedUsers = [];
			errors = {};

			onCreated();
		} catch (err) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid skapande',
				description: err.message || 'Kunde inte skapa notifikationen.'
			});
		}
	}
</script>

<div class="flex w-[600px] max-w-[600px] flex-col gap-2">
	<h2 class="mb-2 text-xl font-semibold text-text">Skapa ny notifikation</h2>

	<Input label="Titel" name="name" bind:value={name} {errors} />
	<TextArea label="Beskrivning" name="description" bind:value={description} />
	<div class="mb-2 grid grid-cols-1 gap-4 xl:grid-cols-2">
		<div class="flex items-center gap-2">
			<Checkbox id="sendAsEmail" bind:checked={sendAsEmail} label="Skicka som mail" />
			<InfoButton
				info="Om detta är markerat skickas notifikationen även som ett e-postmeddelande."
				preferred="right"
				variant="dark"
				letter="?"
			/>
		</div>
		<div class="flex items-center gap-2">
			<Checkbox id="important" bind:checked={isImportant} label="Viktigt meddelande" />
			<InfoButton
				info="Om detta är markerat måste alla användare läsa meddelandet vid inloggning."
				preferred="right"
				variant="dark"
				letter="?"
			/>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
		<Input
			label="Starttid"
			name="start_time"
			type="datetime-local"
			bind:value={start_time}
			{errors}
		/>
		<Input label="Sluttid (valfritt)" type="datetime-local" bind:value={end_time} />
	</div>

	<!-- User dropdown and controls -->
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
			openPosition="up"
		/>
		<div class="mt-[30px] flex flex-row gap-2">
			<Button icon="MultiCheck" iconColor="green" variant="secondary" on:click={onSelectAllUsers} />
			<Button icon="Trash" iconColor="red" variant="secondary" on:click={onDeSelectAllUsers} />
		</div>
	</div>

	{#if errors.user_ids}
		<p class="mt-1 text-sm text-red-500">{errors.user_ids}</p>
	{/if}

	<!-- Selected user list -->
	<FilterBox
		title="Mottagare"
		{selectedUsers}
		on:removeFilter={(event) => {
			const { type, id } = event.detail;
			if (type === 'trainer') selectedUsers = selectedUsers.filter((u) => u.id !== id);
		}}
	/>

	<Button
		full
		iconRight="Notification"
		iconRightSize="16"
		text="Skapa notifikation"
		on:click={submit}
	/>
</div>
