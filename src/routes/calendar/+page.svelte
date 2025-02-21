<script lang="ts">
	import { capitalizeFirstLetter } from '$lib/helpers/generic/genericHelpers';
	import { calendarStore } from '$lib/stores/calendarStore';
	import Button from '../../components/bits/button/Button.svelte';
	import OptionButton from '../../components/bits/optionButton/OptionButton.svelte';
	import CalendarComponent from '../../components/view/calendar/CalendarComponent.svelte';

	$: filters = $calendarStore.filters;

	$: filters && console.log(filters.date);

	$: selectedDate = filters.date ? new Date(filters.date) : new Date();

	$: formattedMonthYear = capitalizeFirstLetter(
		selectedDate.toLocaleDateString('sv-SE', {
			month: 'long',
			year: 'numeric'
		})
	);

	let calendarView = { value: false, label: 'Vecka', icon: 'Week' };

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
</script>

<div class="h-full overflow-x-scroll custom-scrollbar">
	<div class="flex flex-row items-center justify-between">
		<div class="flex flex-row items-center gap-4">
			<p class="p-4 text-2xl font-thin">{formattedMonthYear}</p>
			<div class="w-60">
				<OptionButton
					options={dayOrWeekOptions}
					size="small"
					bind:selectedOption={calendarView}
					on:select={handleViewChange}
				/>
			</div>
		</div>
		<div class="flex flex-row gap-2">
			<Button icon="ChevronLeft" variant="secondary" iconSize="16px"></Button>
			<Button text="Idag" variant="secondary"></Button>
			<Button icon="ChevronRight" variant="secondary" iconSize="16px"></Button>
		</div>
		<div class="flex flex-row gap-2">
			<Button icon="Filter" variant="secondary" iconSize="16px"></Button>

			<Button iconLeft="Plus" variant="primary" text="Boka" iconLeftSize="13px"></Button>
		</div>
	</div>

	<CalendarComponent singleDayView={calendarView.value} />
</div>
