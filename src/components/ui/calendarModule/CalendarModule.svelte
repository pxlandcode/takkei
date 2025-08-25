<script lang="ts">
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { get, writable } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/userStore';
	import { calendarStore } from '$lib/stores/calendarStore';

	// Props
	export let selectedDate: Date = new Date();

	const dispatch = createEventDispatcher();
	const currentUser = get(user);

	// Helpers
	function startOfMonth(d: Date) {
		return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0);
	}
	function parseLocalDate(isoDate: string) {
		const [y, m, d] = isoDate.split('-').map(Number);
		return new Date(y, m - 1, d, 12, 0, 0, 0);
	}
	function sameMonthYear(a: Date, b: Date) {
		return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
	}

	// Days of the week (Swedish: Monday start)
	const daysOfWeek = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

	// Calendar state
	const currentDate = writable(startOfMonth(new Date()));
	let todayRef: HTMLDivElement | null = null;
	const todayRowIndex = writable<number | null>(null);

	// Force recompute via primitive key (belt and suspenders)
	$: currentKey = $currentDate.getTime();
	$: monthDays = getMonthDays(new Date(currentKey));

	let selectedWeekRowIndex: number | null = null;

	// ---- Store → calendar sync (only when store date string changes) ----
	$: storeDateStr = $calendarStore.filters.date ?? null;
	$: if (storeDateStr) {
		const parsed = parseLocalDate(storeDateStr);
		// Show that month, but don't touch store date
		currentDate.set(startOfMonth(parsed));
	}

	// Compute selected band row if selected date is inside current grid
	$: {
		const selected = storeDateStr ? parseLocalDate(storeDateStr) : null;
		if (selected) {
			const idx = monthDays.findIndex((d) => d.toDateString() === selected.toDateString());
			selectedWeekRowIndex = idx !== -1 ? Math.floor(idx / 7) : null;
		} else {
			selectedWeekRowIndex = null;
		}
	}

	function getMonthDays(date: Date) {
		const year = date.getFullYear();
		const month = date.getMonth();
		const firstDayOfMonth = new Date(year, month, 1);
		const lastDayOfMonth = new Date(year, month + 1, 0);
		const daysInMonth: Date[] = [];

		// Leading days (previous month)
		const prevMonthLastDate = new Date(year, month, 0).getDate();
		const firstDayIndex = (firstDayOfMonth.getDay() + 6) % 7; // Monday start
		for (let i = firstDayIndex; i > 0; i--) {
			daysInMonth.push(new Date(year, month - 1, prevMonthLastDate - i + 1));
		}

		// Current month
		for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
			daysInMonth.push(new Date(year, month, i));
		}

		// Trailing days
		const remainder = daysInMonth.length % 7;
		if (remainder !== 0) {
			for (let i = 1; i <= 7 - remainder; i++) {
				daysInMonth.push(new Date(year, month + 1, i));
			}
		}
		return daysInMonth;
	}

	// ------- NAV BUTTONS: page the calendar only (do NOT update store) -------
	function prevMonth() {
		const cur = get(currentDate);
		currentDate.set(startOfMonth(new Date(cur.getFullYear(), cur.getMonth() - 1, 1)));
		// keep band off until a date in this month is selected
		selectedWeekRowIndex = null;
	}

	function nextMonth() {
		const cur = get(currentDate);
		currentDate.set(startOfMonth(new Date(cur.getFullYear(), cur.getMonth() + 1, 1)));
		selectedWeekRowIndex = null;
	}

	// ------- DAY CLICK: now we update the store via parent -------
	function selectDate(date: Date) {
		if (!sameMonthYear(date, $currentDate)) {
			currentDate.set(startOfMonth(date));
		}
		dispatch('dateSelect', date);
	}

	// Today helpers
	function isToday(date: Date): boolean {
		const today = new Date();
		return (
			date.getDate() === today.getDate() &&
			date.getMonth() === today.getMonth() &&
			date.getFullYear() === today.getFullYear()
		);
	}
	function isCurrentMonth(): boolean {
		const today = new Date();
		const selected = $currentDate;
		return (
			today.getMonth() === selected.getMonth() && today.getFullYear() === selected.getFullYear()
		);
	}

	// Optional "today" row tracking
	async function updateTodayRow() {
		await tick();
		if (todayRef && isCurrentMonth()) {
			const todayIndex = monthDays.findIndex((d) => isToday(d));
			todayRowIndex.set(todayIndex !== -1 ? Math.floor(todayIndex / 7) : null);
		} else {
			todayRowIndex.set(null);
		}
	}

	function openMyCalender() {
		calendarStore.setNewFilters({ trainerIds: [currentUser.id] }, fetch);
		goto(`/calendar?trainerId=${currentUser.id}`);
	}

	onMount(updateTodayRow);
	$: $currentDate, monthDays, updateTodayRow();
</script>

<div class="relative h-auto w-[320px] rounded-lg p-4 text-sm font-light glass">
	<!-- Header -->
	<div class="mb-4 flex items-center justify-between">
		<div class="flex w-36 flex-row items-center justify-between text-white">
			<button on:click={prevMonth} aria-label="Föregående månad">
				<Icon icon="ChevronLeft" size="16px" />
			</button>
			<h2 class="text-sm">
				{$currentDate.toLocaleString('sv-SE', { month: 'long', year: 'numeric' })}
			</h2>
			<button on:click={nextMonth} aria-label="Nästa månad">
				<Icon icon="ChevronRight" size="16px" />
			</button>
		</div>
		<Button
			text="Min kalender"
			small
			variant="secondary"
			iconLeft="Calendar"
			on:click={openMyCalender}
		/>
	</div>

	<!-- Days of the week -->
	<div class="flex w-full flex-col items-center justify-center">
		<div class="grid grid-cols-7 gap-x-3 text-white">
			{#each daysOfWeek as day}
				<div class="h-8 w-8 text-center">{day}</div>
			{/each}
		</div>

		<div class="relative w-full">
			{#if selectedWeekRowIndex !== null}
				<div
					class="weekband absolute h-8 rounded-full bg-black opacity-50 transition-all duration-300 ease-in-out"
					style="top: {`calc(${selectedWeekRowIndex} * 32px)`};"
				></div>
			{/if}

			<div class="relative z-10 grid grid-cols-7 gap-x-2">
				{#each monthDays as day}
					<button
						class="relative flex h-8 w-8 items-center justify-center rounded-full
						{day.getMonth() !== $currentDate.getMonth() ? 'text-gray-medium' : 'text-white'}
						transition hover:bg-black/50"
						on:click={() => selectDate(day)}
					>
						{#if isToday(day)}
							<div
								bind:this={todayRef}
								class="absolute z-0 h-8 w-8 rounded-full bg-orange hover:bg-primary-hover"
							></div>
						{/if}
						<p class="pointer-events-none z-10">{day.getDate()}</p>
					</button>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.weekband {
		width: calc(100% + 16px);
		left: -8px;
		transition: top 0.3s ease-in-out;
	}
</style>
