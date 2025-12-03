<script lang="ts">
	import { onMount } from 'svelte';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import type { TableType } from '$lib/types/componentTypes';
	import Table from '../../components/bits/table/Table.svelte';
	import { goto } from '$app/navigation';
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import Button from '../../components/bits/button/Button.svelte';
	import OptionButton from '../../components/bits/optionButton/OptionButton.svelte';
	import UserForm from '../../components/ui/userForm/UserForm.svelte';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import BookingPopup from '../../components/ui/bookingPopup/BookingPopup.svelte';
	import MailComponent from '../../components/ui/mailComponent/MailComponent.svelte';
	import { calendarStore } from '$lib/stores/calendarStore';
	import type { CalendarFilters } from '$lib/stores/calendarStore';
	import { getCalendarUrl } from '$lib/helpers/calendarHelpers/calendarNavigation';
	import { openPopup } from '$lib/stores/popupStore';
	import { headerState } from '$lib/stores/headerState.svelte';

	// Headers Configuration with isSearchable
	const headers = [
		{ label: 'Tränare', key: 'name', icon: 'Person', sort: true, isSearchable: true },
		{ label: 'Kontakt', key: 'contact', isSearchable: true },
		{ label: 'Primär lokal', key: 'location', sort: true, isSearchable: true },
		{ label: 'Actions', key: 'actions', isSearchable: false, width: '161px' }
	];

	// Data variables
	let data: TableType = [];
	let filteredData: TableType = [];
	let searchQuery = '';
	let selectedStatusOption = { value: 'active', label: 'Visa aktiva' }; // active | inactive | all

	let selectedTrainerId: number | null = null;
	let selectedTrainerEmail: string | null = null;

	function openUserForm() {
		openPopup({
			header: 'Ny användare',
			icon: 'Plus',
			component: UserForm,
			maxWidth: '720px',
			listeners: {
				created: () => {
					fetchUsers();
				}
			},
			closeOn: ['created']
		});
	}

	$: isAdmin = hasRole('Administrator');

	function onGoToTrainer(id: number) {
		goto(`/users/${id}`);
	}

	function onGoToTrainerCalendar(trainerId: number) {
		const filters: Partial<CalendarFilters> = { trainerIds: [trainerId] };
		calendarStore.setNewFilters(filters, fetch);
		goto(getCalendarUrl(filters));
	}

	function onBookTrainer(trainerId: number) {
		selectedTrainerId = trainerId;
		openBookingPopup(trainerId);
	}

	function onSendEmailToTrainer(email: string) {
		selectedTrainerEmail = email;
		openMailPopup(email);
	}

	function openBookingPopup(trainerId: number | null) {
		openPopup({
			header: 'Bokning',
			icon: 'Plus',
			component: BookingPopup,
			props: { trainerId },
			maxWidth: '650px',
			listeners: {
				close: () => {
					selectedTrainerId = null;
				}
			}
		});
	}

	function openMailPopup(email: string) {
		openPopup({
			header: `Maila ${email}`,
			icon: 'Mail',
			component: MailComponent,
			maxWidth: '900px',
			props: {
				prefilledRecipients: [email],
				lockedFields: ['recipients'],
				autoFetchUsersAndClients: false
			},
			listeners: {
				close: () => {
					selectedTrainerEmail = null;
				}
			}
		});
	}

	// Fetch Users on Mount
	onMount(async () => {
		headerState.title = 'Tränare';
		headerState.icon = 'Person';
		await fetchUsers();
		users.subscribe((userList) => {
			if (!userList || userList.length === 0) return;

			data = userList.map((user) => ({
				id: user.id,
				name: [
					{
						type: 'link',
						label: `${user.firstname} ${user.lastname}`,
						action: () => onGoToTrainer(user.id)
					}
				],
				contact: [
					{
						type: 'link',
						label: user.email,
						action: () => onSendEmailToTrainer(user.email)
					},
					{ type: 'phone', content: user.mobile }
				],
				location: user.default_location || '-',
				isActive: user.active,
				actions: [
					{
						type: 'button',
						label: 'Boka',
						icon: 'Plus',
						variant: 'primary',
						action: () => onBookTrainer(user.id)
					},
					{
						type: 'button',
						label: '',
						icon: 'Calendar',
						variant: 'secondary',
						action: () => onGoToTrainerCalendar(user.id)
					}
				]
			}));

			filteredData = [...data];
		});
	});

	$: {
		const query = searchQuery.toLowerCase().trim();

		filteredData = data.filter((row) => {
			if (selectedStatusOption.value === 'active' && !row.isActive) return false;
			if (selectedStatusOption.value === 'inactive' && row.isActive) return false;

			if (!query) return true;

			return headers.some((header) => {
				const value = row[header.key];

				if (header.isSearchable && typeof value === 'string') {
					return value.toLowerCase().includes(query);
				}

				if (Array.isArray(value)) {
					return value.some((item) => {
						const s = (item?.content ?? item?.label ?? '').toString().toLowerCase();
						return s.includes(query);
					});
				}

				return false;
			});
		});
	}
</script>

<div class="custom-scrollbar m-4 h-full overflow-x-scroll">
	<!-- Page Title -->

	<div class="hidden items-center gap-2 md:flex">
		<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
			<Icon icon="Person" size="14px" />
		</div>
		<h2 class="text-text text-3xl font-semibold">Tränare</h2>
	</div>
	<div class="my-4 flex flex-row items-center justify-between">
		<div>
			{#if isAdmin}
				<Button text="Lägg till användare" variant="primary" on:click={openUserForm} />
			{/if}
		</div>

		<div class="ml-4 flex flex-col gap-2 xl:flex-row xl:items-center xl:gap-4">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Sök tränare..."
				class="w-full max-w-md min-w-60 rounded-sm border border-gray-300 p-2 focus:border-blue-500 focus:outline-hidden"
			/>
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

	<Table noSelect {headers} data={filteredData} />
</div>

<!-- Popups handled via global store -->
