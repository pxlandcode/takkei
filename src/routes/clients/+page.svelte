<script lang="ts">
	import { onMount } from 'svelte';
	import { clients, fetchClients } from '$lib/stores/clientsStore';
	import { user } from '$lib/stores/userStore';
	import type { TableType } from '$lib/types/componentTypes';
	import Table from '../../components/bits/table/Table.svelte';
	import { goto } from '$app/navigation';
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import Button from '../../components/bits/button/Button.svelte';
	import OptionButton from '../../components/bits/optionButton/OptionButton.svelte';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';

	import ClientForm from '../../components/ui/clientForm/ClientForm.svelte';
	import PopupWrapper from '../../components/ui/popupWrapper/PopupWrapper.svelte';
	import BookingPopup from '../../components/ui/bookingPopup/BookingPopup.svelte';
	import { calendarStore } from '$lib/stores/calendarStore';
	import MailComponent from '../../components/ui/mailComponent/MailComponent.svelte';

	let showClientModal = false;

	function openClientForm() {
		showClientModal = true;
	}

	function closeClientForm() {
		showClientModal = false;
	}

	let showBookingPopup = false;
	let selectedClientsId = null;
	let selectedClientEmail: string | null = null;
	let showMailPopup = false;

	// Headers
	const headers = [
		{ label: 'Klient', key: 'name', icon: 'Person', sort: true, isSearchable: true },
		{ label: 'Kontakt', key: 'contact', isSearchable: true },
		{ label: 'Primär tränare', key: 'trainer', sort: true, isSearchable: true },
		{ label: 'Actions', key: 'actions', isSearchable: false, width: '200px' }
	];

	// Filters
	let selectedStatusOption = { value: 'active', label: 'Visa aktiva' };
	let selectedOwnershipOption = { value: 'mine', label: 'Mina klienter' };

	let data: TableType = [];
	let filteredData: TableType = [];
	let searchQuery = '';

	$: isAdmin = hasRole('Administrator');

	function onGoToClient(id: number) {
		goto(`/clients/${id}`);
	}

	function onGoToClientsCalendar(clientId: number) {
		calendarStore.updateFilters({ clientIds: [clientId] }, fetch);
		goto(`/calendar?clientIds=${clientId}`);
	}

	function onBookClient(clientId: number) {
		selectedClientsId = clientId;
		showBookingPopup = true;
	}

	function onSendClientEmail(email: string) {
		selectedClientEmail = email;
		showMailPopup = true;
	}

	// Fetch Clients
	onMount(async () => {
		await fetchClients();
		clients.subscribe((clientList) => {
			if (!clientList || clientList.length === 0) return;

			data = clientList.map((client) => ({
				id: client.id,
				name: [
					{
						type: 'link',
						label: `${client.firstname} ${client.lastname}`,
						action: () => onGoToClient(client.id)
					}
				],
				contact: [
					{
						type: 'link',
						label: client.email,
						action: () => onSendClientEmail(client.email)
					},
					{ type: 'phone', content: client.phone }
				],
				trainer: client.trainer
					? `${client.trainer.firstname} ${client.trainer.lastname}`
					: 'Ingen',
				trainerId: client.trainer?.id ?? null,
				isActive: client.isActive,
				actions: [
					{
						type: 'button',
						label: 'Boka',
						icon: 'Plus',
						variant: 'primary',
						action: () => onBookClient(client.id)
					},
					{
						type: 'button',
						label: '',
						icon: 'Calendar',
						variant: 'secondary',
						action: () => onGoToClientsCalendar(client.id)
					}
				]
			}));

			filteredData = [...data];
		});
	});

	// Filtering logic
	$: {
		const query = searchQuery.toLowerCase();
		const currentUserId = $user?.id;

		filteredData = data.filter((row) => {
			// Status filter
			const status = selectedStatusOption.value;
			const isActive = row.isActive;

			if (status === 'active' && !isActive) return false;
			if (status === 'inactive' && isActive) return false;

			// Ownership filter
			if (selectedOwnershipOption.value === 'mine' && row.trainerId !== currentUserId) {
				return false;
			}

			// Search filter
			if (!query) return true;

			return headers.some((header) => {
				const value = row[header.key];
				if (header.isSearchable && typeof value === 'string') {
					return value.toLowerCase().includes(query);
				}
				if (Array.isArray(value)) {
					return value.some((item) => item.content?.toLowerCase().includes(query));
				}
				return false;
			});
		});
	}
</script>

<div class="m-4 h-full overflow-x-scroll custom-scrollbar">
	<!-- Page Title -->
	<div class="flex items-center gap-2">
		<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="Person" size="14px" />
		</div>
		<h2 class="text-3xl font-semibold text-text">Klienter</h2>
	</div>

	<!-- Filters -->
	<div class="my-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div>
			{#if isAdmin}
				<Button text="Lägg till klient" variant="primary" on:click={openClientForm} />
			{/if}
		</div>

		<div class="flex flex-col gap-2 xl:flex-row xl:items-center xl:gap-4">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Sök klient..."
				class="w-full min-w-60 max-w-md rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
			/>

			<div class="min-w-60">
				<OptionButton
					options={[
						{ value: 'mine', label: 'Mina klienter' },
						{ value: 'all', label: 'Alla klienter' }
					]}
					bind:selectedOption={selectedOwnershipOption}
					size="small"
				/>
			</div>
			<div class="min-w-80">
				<OptionButton
					options={[
						{ value: 'active', label: 'Visa aktiva' },
						{ value: 'inactive', label: 'Visa inaktiva' },
						{ value: 'all', label: 'Visa alla' }
					]}
					bind:selectedOption={selectedStatusOption}
					size="small"
				/>
			</div>
		</div>
	</div>

	<Table {headers} data={filteredData} noSelect />
</div>

{#if showClientModal}
	<PopupWrapper header="Ny klient" icon="Plus" on:close={closeClientForm}>
		<ClientForm
			on:created={() => {
				closeClientForm();
				fetchClients();
			}}
		/>
	</PopupWrapper>
{/if}

{#if showBookingPopup}
	<PopupWrapper
		header="Bokning"
		icon="Plus"
		on:close={() => ((showBookingPopup = false), (selectedClientsId = null))}
	>
		<BookingPopup
			on:close={() => ((showBookingPopup = false), (selectedClientsId = null))}
			clientId={selectedClientsId}
		/>
	</PopupWrapper>
{/if}

{#if showMailPopup && selectedClientEmail}
	<PopupWrapper
		width="900px"
		header="Maila {selectedClientEmail}"
		icon="Mail"
		on:close={() => ((showMailPopup = false), (selectedClientEmail = null))}
	>
		<MailComponent
			prefilledRecipients={[selectedClientEmail]}
			lockedFields={['recipients']}
			autoFetchUsersAndClients={false}
		/>
	</PopupWrapper>
{/if}
