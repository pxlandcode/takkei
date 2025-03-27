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

	// Headers
	const headers = [
		{ label: 'Klient', key: 'name', icon: 'Person', sort: true, isSearchable: true },
		{ label: 'Kontakt', key: 'contact', isSearchable: true },
		{ label: 'Primär tränare', key: 'trainer', sort: true, isSearchable: true },
		{ label: 'Actions', key: 'actions', isSearchable: false }
	];

	// Filters
	let selectedStatusOption = { value: 'active', label: 'Visa aktiva' };
	let selectedOwnershipOption = { value: 'mine', label: 'Mina klienter' };

	let data: TableType = [];
	let filteredData: TableType = [];
	let searchQuery = '';

	function onGoToClient(id: number) {
		goto(`/clients/${id}`);
	}

	// Fetch Clients
	onMount(async () => {
		await fetchClients();
		clients.subscribe((clientList) => {
			if (!clientList || clientList.length === 0) return;

			data = clientList.map((client) => ({
				id: client.id,
				name: `${client.firstname} ${client.lastname}`,
				contact: [
					{ type: 'email', content: client.email },
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
						label: '',
						icon: 'Person',
						variant: 'secondary',
						action: () => goto(`/clients/${client.id}`)
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
		<Button
			text="Lägg till klient"
			variant="primary"
			on:click={() => alert('Add Client clicked')}
		/>

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

	<Table {headers} data={filteredData} />
</div>
