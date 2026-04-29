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
	import { closePopup } from '$lib/stores/popupStore';
	import { user } from '$lib/stores/userStore';
	import Checkbox from '../../bits/checkbox/Checkbox.svelte';
	import InfoButton from '../../bits/infoButton/InfoButton.svelte';
	import { sendMail } from '$lib/services/mail/mailClientService';
	import type { User } from '$lib/types/userTypes';

	type EditableNotification = {
		id: number;
		name: string;
		description: string;
		start_time?: string | null;
		end_time?: string | null;
		user_ids: number[];
		event_type?: string | null;
		event_type_id?: number | null;
	};

	export let mode: 'create' | 'edit' = 'create';
	export let notification: EditableNotification | null = null;

	const dispatch = createEventDispatcher();

	function getLocalDateTimeValue(date = new Date()) {
		const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
		return localDate.toISOString().slice(0, 16);
	}

	let name = notification?.name ?? '';
	let description = notification?.description ?? '';
	let start_time = notification?.start_time
		? getLocalDateTimeValue(new Date(notification.start_time))
		: getLocalDateTimeValue();
	let end_time = notification?.end_time
		? getLocalDateTimeValue(new Date(notification.end_time))
		: '';
	let selectedUsers: User[] = [];
	let errors: Record<string, string> = {};
	let isImportant = notification?.event_type_id === 2 || notification?.event_type === 'alert';
	let sendAsEmail = false;

	onMount(async () => {
		if (get(users).length === 0) {
			await fetchUsers();
		}

		if (mode === 'edit' && notification?.user_ids?.length) {
			const selectedUserIds = new Set(notification.user_ids);
			selectedUsers = get(users).filter((candidate) => selectedUserIds.has(candidate.id));
		}
	});

	function handleUserSelection(event: CustomEvent<{ selected: User[] }>) {
		selectedUsers = [...event.detail.selected];
	}

	function onSelectAllUsers() {
		selectedUsers = get(users);
	}

	function onDeSelectAllUsers() {
		selectedUsers = [];
	}

	function getErrorMessage(error: unknown) {
		return error instanceof Error ? error.message : 'Något gick fel.';
	}

	function validate() {
		errors = {};
		if (!name) errors.name = 'Titel krävs';
		if (!start_time) errors.start_time = 'Starttid krävs';
		if (end_time && new Date(end_time).getTime() <= new Date(start_time).getTime()) {
			errors.end_time = 'Sluttid måste vara senare än starttid';
		}
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
		const currentUserId = $user?.id;
		const isEdit = mode === 'edit' && Boolean(notification?.id);
		const endpoint = isEdit ? `/api/notifications/${notification?.id}` : '/api/notifications';
		const method = isEdit ? 'PUT' : 'POST';

		if (!isEdit && !currentUserId) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid skapande',
				description: 'Kunde inte identifiera användaren som skapar notifikationen.'
			});
			return;
		}

		try {
			const body: Record<string, unknown> = {
				name,
				description,
				start_time,
				end_time: end_time || null,
				notify_at: 'start_time',
				user_ids,
				event_type_id: isImportant ? 2 : null
			};

			if (!isEdit) {
				body.created_by = currentUserId;
			}

			const res = await fetch(endpoint, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!res.ok) throw new Error((await res.json()).error || 'Fel vid skapande');
			const saved = await res.json();

			if (!isEdit) {
				addToast({
					type: AppToastType.SUCCESS,
					message: 'Notifikation skapad!',
					description: `Notifikationen "${saved.name}" skapades för ${user_ids.length} användare.`
				});
			} else {
				addToast({
					type: AppToastType.SUCCESS,
					message: 'Notifikationen uppdaterades',
					description: saved.name
				});
			}

			if (!isEdit && sendAsEmail) {
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
						description: getErrorMessage(emailErr)
					});
				}
			}

			if (isEdit) {
				dispatch('updated', { notification: saved });
				closePopup();
			} else {
				name = '';
				description = '';
				start_time = getLocalDateTimeValue();
				end_time = '';
				selectedUsers = [];
				errors = {};
				onCreated();
				closePopup();
			}
		} catch (err) {
			addToast({
				type: AppToastType.CANCEL,
				message: isEdit ? 'Fel vid uppdatering' : 'Fel vid skapande',
				description: getErrorMessage(err) || 'Kunde inte skapa notifikationen.'
			});
		}
	}
</script>

<div class="flex w-full max-w-[600px] flex-col gap-2">
	<h2 class="text-text mb-2 text-xl font-semibold">
		{mode === 'edit' ? 'Ändra notifikation' : 'Skapa ny notifikation'}
	</h2>

	<Input label="Titel" name="name" bind:value={name} {errors} />
	<TextArea label="Beskrivning" name="description" bind:value={description} />
	<div class="mb-2 grid grid-cols-1 gap-4 {mode === 'create' ? 'xl:grid-cols-2' : ''}">
		{#if mode === 'create'}
			<div class="flex items-center gap-2">
				<Checkbox id="sendAsEmail" bind:checked={sendAsEmail} label="Skicka som mail" />
				<InfoButton
					info="Om detta är markerat skickas notifikationen även som ett e-postmeddelande."
					preferred="right"
					variant="dark"
					letter="?"
				/>
			</div>
		{/if}
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
		<Input
			label="Sluttid (valfritt)"
			name="end_time"
			type="datetime-local"
			bind:value={end_time}
			{errors}
		/>
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
		on:removeFilter={(event: CustomEvent<{ type: string; id: number }>) => {
			const { type, id } = event.detail;
			if (type === 'trainer') selectedUsers = selectedUsers.filter((u) => u.id !== id);
		}}
	/>

	<Button
		full
		iconRight="Notification"
		iconRightSize="16"
		text={mode === 'edit' ? 'Spara ändringar' : 'Skapa notifikation'}
		on:click={submit}
	/>
</div>
