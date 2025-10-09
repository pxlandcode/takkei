<script lang="ts">
	import { capitalizeFirstLetter } from '$lib/helpers/generic/genericHelpers';
	import { calendarStore } from '$lib/stores/calendarStore';
	import { onMount, onDestroy } from 'svelte';
	import Button from '../../components/bits/button/Button.svelte';
	import OptionButton from '../../components/bits/optionButton/OptionButton.svelte';
	import BookingPopup from '../../components/ui/bookingPopup/BookingPopup.svelte';
	import FilteringPopup from '../../components/ui/filteringPopup/FilteringPopup.svelte';
	import CalendarComponent from '../../components/view/calendar/CalendarComponent.svelte';
	import BookingDetailsPopup from '../../components/ui/bookingDetailsPopup/BookingDetailsPopup.svelte';
	import type { FullBooking } from '$lib/types/calendarTypes';
	import { openPopup } from '$lib/stores/popupStore';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';

	export let data;

	let isMobile = false;
	let mobileWeekExpanded = false;
	let preferredMobileFilterKey: 'clientIds' | 'locationIds' | 'trainerIds' | null = null;
	let hasShownMobileFilterToast = false;
	let resizeHandler: (() => void) | undefined;

	$: filters = $calendarStore.filters;

	function parseLocalDateForCalendar(dateInput?: string | null) {
		if (!dateInput) {
			return new Date();
		}
		const [year, month, day] = dateInput.split('-').map(Number);
		return new Date(year, month - 1, day, 12, 0, 0, 0);
	}

	$: selectedDate = parseLocalDateForCalendar(filters.date);

	$: formattedMonthYear = capitalizeFirstLetter(
		selectedDate.toLocaleDateString('sv-SE', {
			month: 'long',
			year: 'numeric'
		})
	);

	const weekOption = { value: false, label: 'Vecka', icon: 'Week' };
	const dayOption = { value: true, label: 'Dag', icon: 'Day' };

	const dayOrWeekOptions = [weekOption, dayOption];

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

	let calendarView = weekOption;

	$: mobileWeekActive = !calendarView.value && isMobile;

	$: if (mobileWeekActive) {
		mobileWeekExpanded = false;
		enforceMobileWeekFilters();
	} else {
		hasShownMobileFilterToast = false;
	}

	onMount(() => {
		if (typeof window === 'undefined') return;
		const updateIsMobile = () => {
			isMobile = window.innerWidth < 768;
		};
		updateIsMobile();
		resizeHandler = () => {
			const previous = isMobile;
			updateIsMobile();
			if (!isMobile && previous !== isMobile) {
				mobileWeekExpanded = false;
			}
		};
		window.addEventListener('resize', resizeHandler);
	});

	onDestroy(() => {
		if (typeof window === 'undefined') return;
		if (resizeHandler) {
			window.removeEventListener('resize', resizeHandler);
		}
	});

	function handleViewChange(e) {
		let isDayView = e.detail;
		calendarView = isDayView ? dayOption : weekOption;
		if (!isDayView) {
			calendarStore.goToWeek(selectedDate, fetch);
		} else {
			mobileWeekExpanded = false;
			calendarStore.goToDate(selectedDate, fetch);
		}
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

	function handleMobileDaySelect(event) {
		const mobileDate = event.detail?.date;
		if (!mobileDate) return;
		const parsedDate = parseLocalDateForCalendar(mobileDate);
		calendarView = dayOption;
		mobileWeekExpanded = true;
		calendarStore.goToDate(parsedDate, fetch);
	}

	function returnToMobileWeek() {
		calendarView = weekOption;
		mobileWeekExpanded = false;
		calendarStore.goToWeek(selectedDate, fetch);
	}

	function returnToDay() {
		calendarView = dayOption;
		mobileWeekExpanded = true;
		calendarStore.goToDate(selectedDate, fetch);
	}

	function getSelectionSummary() {
		return [
			{
				key: 'clientIds' as const,
				values: Array.isArray(filters?.clientIds) ? filters.clientIds : []
			},
			{
				key: 'locationIds' as const,
				values: Array.isArray(filters?.locationIds) ? filters.locationIds : []
			},
			{
				key: 'trainerIds' as const,
				values: Array.isArray(filters?.trainerIds) ? filters.trainerIds : []
			}
		];
	}

	function arraysEqual(a: number[], b: number[]) {
		if (a.length !== b.length) return false;
		return a.every((value, index) => value === b[index]);
	}

	function enforceMobileWeekFilters() {
		if (!filters) return;
		const summary = getSelectionSummary();
		const activeGroups = summary.filter((item) => item.values.length > 0);

		if (activeGroups.length === 0) {
			return;
		}

		const hasMultipleGroups = activeGroups.length > 1;
		const groupWithMultipleSelections = activeGroups.find((item) => item.values.length > 1);

		if (!hasMultipleGroups && !groupWithMultipleSelections) {
			preferredMobileFilterKey = activeGroups[0]?.key ?? null;
			return;
		}

		const preferredGroup =
			activeGroups.find((item) => item.key === preferredMobileFilterKey) ?? activeGroups[0];

		const desiredClientIds =
			preferredGroup.key === 'clientIds' ? preferredGroup.values.slice(0, 1) : [];
		const desiredLocationIds =
			preferredGroup.key === 'locationIds' ? preferredGroup.values.slice(0, 1) : [];
		const desiredTrainerIds =
			preferredGroup.key === 'trainerIds' ? preferredGroup.values.slice(0, 1) : [];

		const currentClientIds = Array.isArray(filters.clientIds) ? filters.clientIds : [];
		const currentLocationIds = Array.isArray(filters.locationIds) ? filters.locationIds : [];
		const currentTrainerIds = Array.isArray(filters.trainerIds) ? filters.trainerIds : [];

		const shouldUpdate =
			!arraysEqual(currentClientIds, desiredClientIds) ||
			!arraysEqual(currentLocationIds, desiredLocationIds) ||
			!arraysEqual(currentTrainerIds, desiredTrainerIds);

		if (!shouldUpdate) {
			preferredMobileFilterKey = preferredGroup.key;
			return;
		}

		calendarStore.updateFilters(
			{
				clientIds: preferredGroup.key === 'clientIds' ? desiredClientIds : null,
				locationIds: preferredGroup.key === 'locationIds' ? desiredLocationIds : [],
				trainerIds: preferredGroup.key === 'trainerIds' ? desiredTrainerIds : null
			},
			fetch
		);

		if (!hasShownMobileFilterToast) {
			addToast({
				type: AppToastType.NOTE,
				message: 'Mobil vecka',
				description: 'Vi behöll endast ett aktivt filter för att visa veckan på mobilen.'
			});
			hasShownMobileFilterToast = true;
		}

		preferredMobileFilterKey = preferredGroup.key;
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
			{#if isMobile}
				{#if mobileWeekExpanded}
					<Button variant="secondary" icon="Week" iconSize="16px" on:click={returnToMobileWeek} />
				{:else}
					<Button variant="secondary" icon="Day" iconSize="16px" on:click={returnToDay} />
				{/if}
			{/if}
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
			{isMobile}
			mobileWeekMode={mobileWeekActive}
			on:onTimeSlotClick={handleTimeSlotClick}
			on:onBookingClick={(e) => {
				handleBookingClick(e.detail.booking);
			}}
			on:daySelected={handleMobileDaySelect}
		/>
	{/key}
</div>
