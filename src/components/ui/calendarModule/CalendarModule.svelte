<script lang="ts">
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { writable } from 'svelte/store';
	import { goto } from '$app/navigation';

	// Props
	export let selectedDate: Date = new Date();

	const dispatch = createEventDispatcher();

	// Reactive store for the current month
	const currentDate = writable(new Date());

	// Days of the week (Swedish: Monday start)
	const daysOfWeek = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

	// Reference for today's highlight circle
	let todayRef: HTMLDivElement | null = null;

	// Store to track the top position of today's row
	const todayRowIndex = writable(null);

	// Compute the month days reactively
	$: monthDays = getMonthDays($currentDate);

	// Get the first and last day of the month
	function getMonthDays(date: Date) {
		const year = date.getFullYear();
		const month = date.getMonth();
		const firstDayOfMonth = new Date(year, month, 1);
		const lastDayOfMonth = new Date(year, month + 1, 0);
		const daysInMonth: Date[] = [];

		// Days from the previous month
		let prevMonthLastDate = new Date(year, month, 0).getDate();
		let firstDayIndex = (firstDayOfMonth.getDay() + 6) % 7; // Adjust for Monday start

		for (let i = firstDayIndex; i > 0; i--) {
			daysInMonth.push(new Date(year, month - 1, prevMonthLastDate - i + 1));
		}

		// Current month days
		for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
			daysInMonth.push(new Date(year, month, i));
		}

		// Days from the next month to complete the last week
		let nextMonthDays = 7 - (daysInMonth.length % 7);
		if (nextMonthDays < 7) {
			for (let i = 1; i <= nextMonthDays; i++) {
				daysInMonth.push(new Date(year, month + 1, i));
			}
		}

		return daysInMonth;
	}

	// Go to the previous month
	function prevMonth() {
		currentDate.update((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1));
	}

	// Go to the next month
	function nextMonth() {
		currentDate.update((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1));
	}

	// Check if a date is today
	function isToday(date: Date): boolean {
		const today = new Date();
		return (
			date.getDate() === today.getDate() &&
			date.getMonth() === today.getMonth() &&
			date.getFullYear() === today.getFullYear()
		);
	}

	// Check if the current selected month is the actual month
	function isCurrentMonth(): boolean {
		const today = new Date();
		const selected = $currentDate;
		return (
			today.getMonth() === selected.getMonth() && today.getFullYear() === selected.getFullYear()
		);
	}

	// Handle date click
	function selectDate(date: Date) {
		console.log('date', date);
		if (date.getMonth() !== $currentDate.getMonth()) {
			if (date.getMonth() > $currentDate.getMonth()) {
				nextMonth();
			} else {
				prevMonth();
			}
			return;
		}
		dispatch('dateSelect', date);
	}

	// Find which row today is in
	async function updateTodayRow() {
		await tick(); // Ensures DOM is updated before checking position

		if (todayRef && isCurrentMonth()) {
			const todayIndex = monthDays.findIndex((d) => isToday(d));
			if (todayIndex !== -1) {
				const rowIndex = Math.floor(todayIndex / 7);
				todayRowIndex.set(rowIndex);
			}
		} else {
			todayRowIndex.set(null);
		}
	}

	function openCalender() {
		goto('/calendar');
	}

	// Run update when component is mounted
	onMount(updateTodayRow);
</script>

<div class="relative w-[320px] p-4 text-sm font-light glass rounded-4xl">
	<!-- Header -->
	<div class="mb-4 flex items-center justify-between">
		<div class="flex w-36 flex-row items-center justify-between text-white">
			<button on:click={prevMonth}>
				<Icon icon="ChevronLeft" size="16px" />
			</button>
			<h2 class="text-sm">
				{$currentDate.toLocaleString('sv-SE', { month: 'long', year: 'numeric' })}
			</h2>
			<button on:click={nextMonth}>
				<Icon icon="ChevronRight" size="16px" />
			</button>
		</div>
		<Button
			small
			text="Kalender"
			variant="secondary"
			iconLeft="Calendar"
			iconRight="ChevronRight"
		/>
	</div>

	<!-- Days of the week -->
	<div class="flex h-full w-full flex-col items-center justify-center">
		<div class="grid grid-cols-7 gap-x-3 text-white">
			{#each daysOfWeek as day}
				<div class="h-8 w-8 text-center">{day}</div>
			{/each}
		</div>

		<div class="relative w-full">
			<!-- Current Week Background Band (Only if Current Month is Selected) -->
			{#if $todayRowIndex !== null && isCurrentMonth()}
				<div
					class="weekband absolute h-8 rounded-full bg-black opacity-50"
					style="top: calc({$todayRowIndex} * 32px);"
				></div>
			{/if}

			<!-- Days Grid -->
			<div class="relative z-10 grid grid-cols-7 gap-x-2">
				{#each monthDays as day, index}
					<button
						class="relative flex h-8 w-8 items-center justify-center rounded-full
						{day.getMonth() !== $currentDate.getMonth() ? 'text-gray-medium' : 'text-white'}
						transition hover:bg-black/50"
						on:click={() => selectDate(day)}
					>
						<!-- Today Highlight (Orange Circle) -->
						{#if isToday(day)}
							<div
								bind:this={todayRef}
								class="absolute z-0 h-8 w-8 rounded-full bg-orange hover:bg-primary-hover"
							></div>
						{/if}
						<p class="pointer-events-none z-10">
							{day.getDate()}
						</p>
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
	}
</style>
