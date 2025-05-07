<script lang="ts">
	import { onMount } from 'svelte';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import type { TableType } from '$lib/types/componentTypes';
	import Table from '../../components/bits/table/Table.svelte';
	import { goto } from '$app/navigation';
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import Button from '../../components/bits/button/Button.svelte';
	import UserForm from '../../components/ui/userForm/UserForm.svelte';
	import PopupWrapper from '../../components/ui/popupWrapper/PopupWrapper.svelte';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';

	// Headers Configuration with isSearchable
	const headers = [
		{ label: 'Tränare', key: 'name', icon: 'Person', sort: true, isSearchable: true },
		{ label: 'Kontakt', key: 'contact', isSearchable: true },
		{ label: 'Primär lokal', key: 'location', sort: true, isSearchable: true },
		{ label: 'Actions', key: 'actions', isSearchable: false }
	];

	// Data variables
	let data: TableType = [];
	let filteredData: TableType = [];
	let searchQuery = '';

	let showUserModal = false;

	function openUserForm() {
		showUserModal = true;
	}

	function closeUserForm() {
		showUserModal = false;
	}

	$: isAdmin = hasRole('Administrator');

	function onGoToTrainer(id: number) {
		goto(`/users/${id}`);
	}

	// Fetch Users on Mount
	onMount(async () => {
		await fetchUsers();
		users.subscribe((userList) => {
			if (!userList || userList.length === 0) return;

			data = userList.map((user) => ({
				name: `${user.firstname} ${user.lastname}`,
				contact: [
					{ type: 'email', content: user.email },
					{ type: 'phone', content: user.mobile }
				],
				location: user.default_location || '-',
				actions: [
					{
						type: 'button',
						label: 'Boka',
						icon: 'Plus',
						variant: 'primary',
						action: () => alert(`Boka ${user.firstname}`)
					},
					{
						type: 'button',
						label: '',
						icon: 'Calendar',
						variant: 'secondary',
						action: () => goto(`/calendar?trainerId=${user.id}`)
					},
					{
						type: 'button',
						label: '',
						icon: 'Person',
						variant: 'secondary',
						action: () => goto(`/users/${user.id}`)
					}
				]
			}));

			filteredData = [...data];
		});
	});

	$: {
		const query = searchQuery.toLowerCase();
		filteredData = query
			? data.filter((row) =>
					headers.some(
						(header) =>
							(header.isSearchable &&
								typeof row[header.key] === 'string' &&
								row[header.key].toLowerCase().includes(query)) ||
							(Array.isArray(row[header.key]) &&
								row[header.key].some((item) => item.content?.toLowerCase().includes(query)))
					)
				)
			: data;
	}
</script>

<div class="m-4 h-full overflow-x-scroll custom-scrollbar">
	<!-- Page Title -->

	<div class=" flex items-center gap-2">
		<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="Person" size="14px" />
		</div>
		<h2 class="text-3xl font-semibold text-text">Tränare</h2>
	</div>
	<div class="my-4 flex flex-row items-center justify-between">
		<div>
			{#if isAdmin}
				<Button text="Lägg till användare" variant="primary" on:click={openUserForm} />
			{/if}
		</div>

		<div class="ml-4 flex flex-row gap-4">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Sök tränare..."
				class="w-full max-w-md rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
			/>
			<div class="span">
				<Button icon="Filter" variant="secondary" on:click={() => alert('Filter clicked')}></Button>
			</div>
		</div>
	</div>

	<Table {headers} data={filteredData} />
</div>

{#if showUserModal}
	<PopupWrapper header="Ny användare" icon="Plus" on:close={closeUserForm}>
		<UserForm
			on:created={() => {
				closeUserForm();
				fetchUsers();
			}}
		/>
	</PopupWrapper>
{/if}
