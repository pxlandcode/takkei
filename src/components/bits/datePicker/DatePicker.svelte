<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { clickOutside } from '$lib/actions/clickOutside';
	import Icon from '../icon-component/Icon.svelte';

	type CalendarCell = {
		date: Date;
		label: number;
		isCurrentMonth: boolean;
		isToday: boolean;
		isSelected: boolean;
		disabled: boolean;
	};

	type ChangeEventDetail = { value: string };

	export let id: string;
	export let label: string = 'Datum';
	export let name: string = '';
	export let placeholder: string = 'Välj datum';
	export let value: string = '';
	export let disabled: boolean = false;
	export let errors: Record<string, string> = {};
	export let openPosition: 'up' | 'down' | null = null;
	export let minDate: string | null = null;
	export let maxDate: string | null = null;
	export let labelIcon: string = '';
	export let labelIconSize: string = '20px';

	const dispatch = createEventDispatcher<{ change: ChangeEventDetail }>();

	const WEEKDAY_LABELS = ['Må', 'Ti', 'On', 'To', 'Fr', 'Lö', 'Sö'];

	let showCalendar = false;
	let calendarPosition: 'up' | 'down' = 'down';
	let triggerElement: HTMLButtonElement | null = null;
	let calendarMonth: Date = startOfMonth(new Date());

	$: selectedDate = value ? parseDate(value) : null;
	$: if (selectedDate && !showCalendar) {
		calendarMonth = startOfMonth(selectedDate);
	}
	$: parsedMinDate = minDate ? parseDate(minDate) : null;
	$: parsedMaxDate = maxDate ? parseDate(maxDate) : null;
	$: calendarDays = buildCalendarDays(calendarMonth, selectedDate, parsedMinDate, parsedMaxDate);
	$: visibleMonthLabel = formatMonth(calendarMonth);
	$: errorMessage = errors?.[name || id];

	function toggleCalendar(event?: MouseEvent) {
		if (disabled) return;
		event?.stopPropagation();
		if (!showCalendar) {
			determinePosition();
			if (selectedDate) {
				calendarMonth = startOfMonth(selectedDate);
			}
		}
		showCalendar = !showCalendar;
	}

	function determinePosition() {
		if (!triggerElement) return;
		const rect = triggerElement.getBoundingClientRect();
		const spaceBelow = window.innerHeight - rect.bottom;
		const spaceAbove = rect.top;
		const defaultPosition = spaceBelow < 320 && spaceAbove > spaceBelow ? 'up' : 'down';
		calendarPosition = openPosition ?? defaultPosition;
	}

	function closeCalendar() {
		showCalendar = false;
	}

	function selectDate(cell: CalendarCell) {
		if (cell.disabled) return;
		value = formatDate(cell.date);
		dispatch('change', { value });
		showCalendar = false;
	}

	function goToPreviousMonth() {
		calendarMonth = addMonths(calendarMonth, -1);
	}

	function goToNextMonth() {
		calendarMonth = addMonths(calendarMonth, 1);
	}

	function parseDate(input: string): Date {
		const [y, m, d] = input.split('-').map(Number);
		return new Date(y, (m || 1) - 1, d || 1);
	}

	function formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function startOfMonth(date: Date): Date {
		return new Date(date.getFullYear(), date.getMonth(), 1);
	}

	function addMonths(date: Date, amount: number): Date {
		return new Date(date.getFullYear(), date.getMonth() + amount, 1);
	}

	function isSameDay(a: Date | null, b: Date | null): boolean {
		if (!a || !b) return false;
		return (
			a.getFullYear() === b.getFullYear() &&
			a.getMonth() === b.getMonth() &&
			a.getDate() === b.getDate()
		);
	}

	function formatMonth(date: Date): string {
		return date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
	}

	function buildCalendarDays(
		reference: Date,
		currentSelection: Date | null,
		min: Date | null,
		max: Date | null
	): CalendarCell[] {
		const days: CalendarCell[] = [];
		const monthStart = startOfMonth(reference);
		const startWeekday = getWeekdayIndex(monthStart);
		const gridStart = new Date(monthStart);
		gridStart.setDate(monthStart.getDate() - startWeekday);

		for (let i = 0; i < 42; i += 1) {
			const cellDate = new Date(gridStart);
			const normalized = trimTime(cellDate);
			const disabled = (min && normalized < trimTime(min)) || (max && normalized > trimTime(max));

			days.push({
				date: cellDate,
				label: cellDate.getDate(),
				isCurrentMonth: cellDate.getMonth() === reference.getMonth(),
				isToday: isSameDay(cellDate, new Date()),
				isSelected: isSameDay(cellDate, currentSelection),
				disabled
			});

			gridStart.setDate(gridStart.getDate() + 1);
		}

		return days;
	}

	function getWeekdayIndex(date: Date): number {
		const day = date.getDay();
		return day === 0 ? 6 : day - 1; // convert Sunday to 6, Monday to 0
	}

	function trimTime(date: Date): Date {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate());
	}

	onMount(() => {
		if (value) {
			calendarMonth = startOfMonth(parseDate(value));
		}
	});
</script>

<div class="relative flex w-full flex-col gap-1" use:clickOutside={closeCalendar}>
	<div class="mb-1 flex flex-row items-center gap-2">
		{#if labelIcon}
			<Icon icon={labelIcon} size={labelIconSize} color="gray" />
		{/if}
		<label for={id} class="text-gray mb-1 block text-sm font-medium">{label}</label>
	</div>

	<button
		type="button"
		class={`group flex w-full flex-row items-center justify-between rounded border px-3 py-2 text-left transition-colors duration-150
		${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
		${errorMessage ? 'border-red-500' : 'border-gray'}
		${showCalendar ? 'bg-gray text-white' : 'bg-white text-black'}`}
		{id}
		{name}
		bind:this={triggerElement}
		on:click={toggleCalendar}
		aria-haspopup="dialog"
		aria-expanded={showCalendar}
		aria-controls={`${id}-calendar`}
		{disabled}
	>
		<div class="text-gray pointer-events-none mr-2">
			<Icon icon="Calendar" size="18px" />
		</div>
		<span class={`flex-1 truncate ${value ? 'text-current' : 'text-gray-400'}`}>
			{value || placeholder}
		</span>
		<svg
			class={`h-3 w-3 transition-transform duration-300 ${showCalendar ? 'rotate-180' : ''}`}
			viewBox="0 0 12 8"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M10.6667 1.33337L6.00004 6.00004L1.33337 1.33337"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	</button>

	{#if errorMessage}
		<p class="text-sm text-red-500">{errorMessage}</p>
	{/if}

	{#if showCalendar}
		<div
			id={`${id}-calendar`}
			class={`border-gray-bright absolute z-50 mt-1 w-full rounded-sm border bg-white shadow-lg ${
				calendarPosition === 'up' ? 'bottom-[calc(100%+0.25rem)] mt-0 mb-1' : 'top-full'
			}`}
		>
			<div
				class="border-gray-bright text-gray flex items-center justify-between border-b px-3 py-2 text-sm font-medium"
			>
				<button
					type="button"
					class="text-gray hover:bg-gray/10 rounded p-1"
					on:click|stopPropagation={goToPreviousMonth}
					aria-label="Föregående månad"
				>
					&lsaquo;
				</button>
				<span class="capitalize">{visibleMonthLabel}</span>
				<button
					type="button"
					class="text-gray hover:bg-gray/10 rounded p-1"
					on:click|stopPropagation={goToNextMonth}
					aria-label="Nästa månad"
				>
					&rsaquo;
				</button>
			</div>
			<div class="text-gray grid grid-cols-7 gap-1 px-3 py-2 text-center text-xs">
				{#each WEEKDAY_LABELS as weekday}
					<span class="font-medium">{weekday}</span>
				{/each}
			</div>
			<div class="grid grid-cols-7 gap-1 px-3 pb-3">
				{#each calendarDays as cell}
					<button
						type="button"
						class={`rounded-sm py-1 text-sm ${
							cell.disabled
								? 'text-gray/40 cursor-not-allowed'
								: cell.isSelected
									? 'bg-gray text-white'
									: cell.isCurrentMonth
										? 'hover:bg-gray/10 text-black'
										: 'text-gray/60 hover:bg-gray/10'
						}
						${cell.isToday && !cell.isSelected ? 'border-gray/50 border' : 'border border-transparent'}`}
						on:click|stopPropagation={() => selectDate(cell)}
						{disabled}
					>
						{cell.label}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
