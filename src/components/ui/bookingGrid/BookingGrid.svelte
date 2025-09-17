<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { tooltip } from '$lib/actions/tooltip';

	export let trainerId: number | null = null;
	export let clientId: number | null = null;
	export let border = false;

	const SQUARE_SIZE = 12;
	const GAP = 2;

	let gridContainer;
	let gridWidth = 0;
	let squareLimit = 53;
	let daysToShow = 365;

	let countsPerDay: Record<string, number> = {};
	let today = new Date();
	let firstValidDate: Date;
	let lastValidDate: Date;

	let days = [];
	let months = [];
	const weekDays = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'];

	$: if (gridContainer) {
		gridWidth = gridContainer.offsetWidth;
		const visibleBlocks = Math.floor(gridWidth / (SQUARE_SIZE + GAP));

		if (visibleBlocks !== squareLimit) {
			squareLimit = visibleBlocks;
			daysToShow = squareLimit * 7;
			setupDates();
			fetchCountsAndRender();
		}
	}

	function formatLocalDate(date: Date) {
		return date.toLocaleDateString('sv-SE', {
			timeZone: 'Europe/Stockholm',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		});
	}

	function setupDates() {
		today.setHours(0, 0, 0, 0);
		const halfRange = Math.floor(daysToShow / 2);
		firstValidDate = new Date(today);
		lastValidDate = new Date(today);

		if (clientId) {
			firstValidDate.setDate(today.getDate() - halfRange);
			lastValidDate.setDate(today.getDate() + halfRange);
		} else {
			firstValidDate.setDate(today.getDate() - (daysToShow - 1));
			lastValidDate = new Date(today);
		}

		// Align to Monday
		const dayOfWeek = firstValidDate.getDay();
		const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
		const weekStart = new Date(firstValidDate);
		weekStart.setDate(weekStart.getDate() - daysToSubtract);

		// Fill days and months
		days = [];
		months = [];
		let currentDate = new Date(weekStart);
		let monthLoop = null;

		while (currentDate <= lastValidDate) {
			const date = new Date(currentDate);
			if (date.getMonth() !== monthLoop) {
				monthLoop = date.getMonth();
				months.push({
					name: date.toLocaleString('sv-SE', { month: 'short' }),
					index: Math.floor(days.length / 7) + 1
				});
			}
			const isBlank = date < firstValidDate;
			days.push({ date, count: isBlank ? null : 0 });
			currentDate.setDate(currentDate.getDate() + 1);
		}
	}

	async function fetchCountsAndRender() {
		if (trainerId && clientId) {
			console.warn('Pass only trainerId OR clientId, not both.');
			return;
		}

		const from = formatLocalDate(firstValidDate);
		const to = formatLocalDate(lastValidDate);
		const params = new URLSearchParams({ from, to });

		if (trainerId) params.append('trainerId', trainerId.toString());
		if (clientId) params.append('clientId', clientId.toString());

		const res = await fetch(`/api/bookings/counts-per-day?${params}`);
		if (!res.ok) {
			console.error(await res.text());
			return;
		}

		countsPerDay = await res.json();

		updateDays();
	}

	function updateDays() {
		days = days.map((day) => {
			if (day.count === null) return day;
			const key = formatLocalDate(day.date);
			return { ...day, count: countsPerDay[key] || 0 };
		});
	}

	onMount(async () => {
		await tick(); // Wait for DOM
		if (gridContainer) {
			gridWidth = gridContainer.offsetWidth;
			const visibleBlocks = Math.floor(gridWidth / (SQUARE_SIZE + GAP));
			squareLimit = visibleBlocks;
			daysToShow = squareLimit * 7;
			setupDates();
			await fetchCountsAndRender();
		}
	});
</script>

<div
	class="max-w-[820px] rounded-lg bg-white {border ? 'border border-gray-200' : ''} p-6 shadow-md"
>
	<div class="mb-4 flex flex-row items-center justify-between">
		{#if trainerId}
			<h4 class="text-xl font-semibold">Bokningar senaste {daysToShow} dagar</h4>
		{:else if clientId}
			<h3 class="text-lg font-semibold text-gray-800">
				Bokningar
				{daysToShow < 60
					? `${Math.floor(daysToShow / 2)} dagar`
					: `${Math.round(daysToShow / 2 / 30)} ${
							Math.round(daysToShow / 2 / 30) === 1 ? 'månad' : 'månader'
						}`}
				bakåt och
				{daysToShow < 60
					? `${Math.ceil(daysToShow / 2)} dagar`
					: `${Math.round(daysToShow / 2 / 30)} ${
							Math.round(daysToShow / 2 / 30) === 1 ? 'månad' : 'månader'
						}`}
				framåt
			</h3>
		{/if}

		<div class="flex flex-row items-center gap-[2px]">
			{#if trainerId}
				<p class="day-label">0</p>
				<div use:tooltip={{ content: '0 bokningar' }} class="cell bg-gray-200"></div>
				<div use:tooltip={{ content: '1 bokning' }} class="cell bg-orange/10"></div>
				<div use:tooltip={{ content: '2 bokningar' }} class="cell bg-orange/30"></div>
				<div use:tooltip={{ content: '3 bokningar' }} class="cell bg-orange/55"></div>
				<div use:tooltip={{ content: '4 bokningar' }} class="cell bg-orange/80"></div>
				<div use:tooltip={{ content: '5 eller fler bokningar' }} class="cell bg-orange"></div>
				<p class="day-label">5+</p>
			{:else}
				<div
					use:tooltip={{ content: '1 bokning har genomförts denna dag' }}
					class="cell bg-orange"
				></div>
				<p class="day-label">Genomförd bokning</p>
				<div use:tooltip={{ content: '1 bokning denna dag' }} class="cell bg-orange/55"></div>
				<p class="day-label">Bokning</p>
			{/if}
		</div>
	</div>

	<!-- Month Labels (Dynamic Width) -->
	<div class="months" style="width: {gridWidth}px;">
		{#each months as month}
			<div class="month-label" style="grid-column: {month.index};">{month.name}</div>
		{/each}
	</div>

	<!-- Booking Grid -->
	<div class="grid-wrapper">
		<!-- Weekday Labels -->
		<div class="weekdays">
			{#each weekDays as day}
				<div class="day-label">{day}</div>
			{/each}
		</div>

		<!-- Booking Grid -->

		<div
			class="grid-container"
			bind:this={gridContainer}
			style="grid-template-columns: repeat({Math.ceil(days.length / 7)}, 12px);"
		>
			{#each days as day, i}
				{#if day.count === null}
					<div
						class="cell bg-transparent"
						style="grid-column: {Math.floor(i / 7) + 1}; grid-row: {(i % 7) + 1};"
					></div>
				{:else if trainerId}
					<div
						use:tooltip={{
							content: `Datum: ${formatLocalDate(day.date)}, Bokningar: ${day.count}`
						}}
						class="cell

                        {day.count === 0 ? 'bg-gray-200' : ''}
                        {day.count === 1 ? 'bg-orange/10' : ''}
						{day.count === 2 ? 'bg-orange/30' : ''}
						{day.count === 3 ? 'bg-orange/55' : ''}
						{day.count === 4 ? 'bg-orange/80' : ''}
						{day.count >= 5 ? 'bg-orange' : ''}"
						style="grid-column: {Math.floor(i / 7) + 1}; grid-row: {(i % 7) + 1};"
					></div>
				{:else if clientId}
					<div
						use:tooltip={{
							content: `Datum: ${formatLocalDate(day.date)} ${trainerId ? `, Bokningar: ${day.count}` : ''}`
						}}
						class="cell

                        {day.count === 0 ? 'bg-gray-200' : ''}
                     {day.count > 0 && day.date <= today ? 'bg-orange' : ''}
                     {day.count > 0 && day.date > today ? 'bg-orange/55' : ''}"
						style="grid-column: {Math.floor(i / 7) + 1}; grid-row: {(i % 7) + 1};"
					></div>{/if}
			{/each}
		</div>
	</div>
</div>

<style>
	.months {
		margin-left: 30px;
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		gap: 2px;
		margin-bottom: 5px;
		max-width: 100%;
	}

	.month-label {
		font-size: 10px;
		text-align: center;
		color: #888;
	}

	.grid-wrapper {
		display: flex;
	}

	.weekdays {
		display: grid;
		grid-template-rows: repeat(7, 12px);
		align-items: center;
		margin-bottom: 5px;
		margin-right: 5px;
		gap: 2px;
	}

	.day-label {
		font-size: 10px;
		color: #888;
		text-align: right;
		padding-right: 5px;
	}

	.grid-container {
		display: grid;
		grid-template-rows: repeat(7, 12px);
		gap: 2px;
		width: 100%;
	}

	.cell {
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}
</style>
