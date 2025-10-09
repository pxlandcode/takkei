<script lang="ts">
	import { capitalizeFirstLetter } from '$lib/helpers/generic/genericHelpers';
	import { calendarStore } from '$lib/stores/calendarStore';
	import { onMount } from 'svelte';
	import Button from '../../components/bits/button/Button.svelte';
	import OptionButton from '../../components/bits/optionButton/OptionButton.svelte';
	import BookingPopup from '../../components/ui/bookingPopup/BookingPopup.svelte';
	import FilteringPopup from '../../components/ui/filteringPopup/FilteringPopup.svelte';
	import CalendarComponent from '../../components/view/calendar/CalendarComponent.svelte';
	import BookingDetailsPopup from '../../components/ui/bookingDetailsPopup/BookingDetailsPopup.svelte';
	import type { FullBooking } from '$lib/types/calendarTypes';
	import { openPopup } from '$lib/stores/popupStore';

	export let data;

	let isMobile = false;

	$: filters = $calendarStore.filters;

	$: selectedDate = filters.date ? new Date(filters.date) : new Date();

	$: formattedMonthYear = capitalizeFirstLetter(
		selectedDate.toLocaleDateString('sv-SE', {
			month: 'long',
			year: 'numeric'
		})
	);

	function handleBookingClick(booking: FullBooking) {
		openPopup({
			header: 'Bokningsdetaljer',
			icon: 'CircleInfo',
			component: BookingDetailsPopup,
			props: { booking },
			maxWidth: '650px',
			listeners: {
				updated: () => {
					calendarStore.refresh(fetch);
				}
			}
		});
	}

	let calendarView = { value: false, label: 'Vecka', icon: 'Week' };

	onMount(() => {
		if (window.innerWidth < 768) {
			isMobile = true;
		}
	});

	$: if (isMobile) {
		calendarView = { value: true, label: 'Dag', icon: 'Day' };
	}

	let dayOrWeekOptions = [
		{ value: false, label: 'Vecka', icon: 'Week' },
		{ value: true, label: 'Dag', icon: 'Day' }
	];

	function handleViewChange(e) {
		let isDayView = e.detail;
		calendarView = {
			value: isDayView,
			label: isDayView ? 'Dag' : 'Vecka',
			icon: isDayView ? 'Day' : 'Week'
		};
	}

	function onNext() {
		if (calendarView.value) {
			calendarStore.goToNextDay(fetch);
		} else {
			calendarStore.goToNextWeek(fetch);
		}
	}

	function onPrevious() {
		if (calendarView.value) {
			calendarStore.goToPreviousDay(fetch);
		} else {
			calendarStore.goToPreviousWeek(fetch);
		}
	}

	function onToday() {
		calendarStore.goToDate(new Date(), fetch);
	}

	function handleTimeSlotClick(event) {
		const timeSlot = event.detail.startTime;
		openBookingPopup(timeSlot);
	}

	function openFilterPopup() {
		openPopup({
			header: 'Filter',
			icon: 'Filter',
			component: FilteringPopup,
			maxWidth: '650px'
		});
	}

	function openBookingPopup(initialStartTime: Date | null = null) {
		openPopup({
			header: 'Bokning',
			icon: 'Plus',
			component: BookingPopup,
			props: { startTime: initialStartTime },
			maxWidth: '960px'
		});
	}
</script>

<div class="custom-scrollbar h-full overflow-x-hidden overflow-y-hidden">
	<div
		class="mx-2 mt-2 flex flex-col items-center gap-4 lg:flex-row lg:items-center lg:justify-between"
	>
		<div class="flex flex-row flex-wrap items-center md:gap-4">
			<p class="p-4 text-2xl font-thin">{formattedMonthYear}</p>
			<div class="hidden w-60 lg:block">
				<OptionButton
					options={dayOrWeekOptions}
					size="small"
					bind:selectedOption={calendarView}
					on:select={handleViewChange}
				/>
			</div>
		</div>
		<div class="mx-auto mr-14 mb-4 flex flex-row gap-2 md:mr-0 md:gap-4 lg:mb-0">
			<div class="flex flex-row gap-2">
				<Button icon="ChevronLeft" variant="secondary" iconSize="16px" on:click={onPrevious}
				></Button>
				<Button text="Idag" variant="secondary" on:click={onToday}></Button>
				<Button icon="ChevronRight" variant="secondary" iconSize="16px" on:click={onNext}></Button>
			</div>
			<div class="flex flex-row gap-2">
				<Button on:click={openFilterPopup} icon="Filter" variant="secondary" iconSize="16px"
				></Button>

				<Button
					iconLeft="Plus"
					variant="primary"
					text="Boka"
					iconLeftSize="13px"
					on:click={() => openBookingPopup(null)}
				></Button>
			</div>
		</div>
	</div>
	{#key calendarView.value}
		<CalendarComponent
			singleDayView={calendarView.value}
			on:onTimeSlotClick={handleTimeSlotClick}
			on:onBookingClick={(e) => {
				handleBookingClick(e.detail.booking);
			}}
		/>
	{/key}
</div>
