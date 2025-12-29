<script lang="ts">
import { onDestroy, onMount, tick } from 'svelte';
import { tooltip } from '$lib/actions/tooltip';
import { wrapFetch } from '$lib/services/api/apiCache';

export let trainerId: number | null = null;
export let clientId: number | null = null;
export let border = false;

const SQUARE_SIZE = 12;
const GAP = 2;
const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
	timeZone: 'Europe/Stockholm',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

type DayCell = { date: Date; key: string; count: number | null };
type MonthLabel = { name: string; index: number };

let gridContainer: HTMLDivElement | undefined;
let gridWidth = 0;
let squareLimit = 53;
let daysToShow = 365;

let countsPerDay: Record<string, number> = {};
let today: Date;
let firstValidDate: Date;
let lastValidDate: Date;

let days: DayCell[] = [];
let months: MonthLabel[] = [];
const weekDays = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'];

let gridReady = false;
let lastFilterKey = '';
let resizeObserver: ResizeObserver | null = null;
let currentFetchController: AbortController | null = null;
const fetchCache = new Map<string, Record<string, number>>();
const cachedFetch = wrapFetch(fetch);

function formatLocalDate(date: Date) {
	return dateFormatter.format(date);
}

function setupDates() {
	today = new Date();
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

	const dayOfWeek = firstValidDate.getDay();
	const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
	const weekStart = new Date(firstValidDate);
	weekStart.setDate(weekStart.getDate() - daysToSubtract);

	days = [];
	months = [];
	let currentDate = new Date(weekStart);
	let monthLoop: number | null = null;

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
		const key = formatLocalDate(date);
		days.push({ date, key, count: isBlank ? null : 0 });
		currentDate.setDate(currentDate.getDate() + 1);
	}
}

function buildFetchKey(from: string, to: string) {
	return `${from}|${to}|${trainerId ?? ''}|${clientId ?? ''}`;
}

async function fetchCountsAndRender(force = false) {
	if (trainerId && clientId) {
		console.warn('Pass only trainerId OR clientId, not both.');
		return;
	}

	const from = formatLocalDate(firstValidDate);
	const to = formatLocalDate(lastValidDate);
	const cacheKey = buildFetchKey(from, to);

	if (!force && fetchCache.has(cacheKey)) {
		countsPerDay = fetchCache.get(cacheKey)!;
		updateDays();
		return;
	}

	currentFetchController?.abort();
	const controller = new AbortController();
	currentFetchController = controller;

	const params = new URLSearchParams({ from, to });
	if (trainerId) params.append('trainerId', trainerId.toString());
	if (clientId) params.append('clientId', clientId.toString());

	try {
		const res = await cachedFetch(`/api/bookings/counts-per-day?${params}`, {
			signal: controller.signal
		});
		if (!res.ok) {
			console.error(await res.text());
			return;
		}

		const data = (await res.json()) as Record<string, number>;
		fetchCache.set(cacheKey, data);
		countsPerDay = data;
		updateDays();
	} catch (error) {
		if ((error as DOMException)?.name === 'AbortError') return;
		console.error('Failed to load counts per day', error);
	}
}

function updateDays() {
	days = days.map((day) => {
		if (day.count === null) return day;
		return { ...day, count: countsPerDay[day.key] ?? 0 };
	});
}

function refreshGrid(force = false) {
	setupDates();
	void fetchCountsAndRender(force);
}

function handleResize(width: number) {
	if (width <= 0) return;
	const visibleBlocks = Math.max(1, Math.floor(width / (SQUARE_SIZE + GAP)));
	if (visibleBlocks === squareLimit && days.length) return;
	squareLimit = visibleBlocks;
	daysToShow = squareLimit * 7;
	refreshGrid();
}

onMount(async () => {
	await tick();
	if (!gridContainer) return;
	gridWidth = gridContainer.offsetWidth;
	handleResize(gridWidth);
	resizeObserver = new ResizeObserver((entries) => {
		const entry = entries[0];
		if (!entry) return;
		gridWidth = entry.contentRect.width;
		handleResize(gridWidth);
	});
	resizeObserver.observe(gridContainer);
	gridReady = true;
});

onDestroy(() => {
	resizeObserver?.disconnect();
	currentFetchController?.abort();
});

$: if (gridReady) {
	const filterKey = `${trainerId ?? ''}|${clientId ?? ''}`;
	if (filterKey !== lastFilterKey) {
		lastFilterKey = filterKey;
		fetchCache.clear();
		refreshGrid(true);
	}
}
</script>

<div
	class="max-w-[820px] rounded-sm bg-white {border ? 'border border-gray-200' : ''} p-6 shadow-md"
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
						content: `Datum: ${day.key}, Bokningar: ${day.count}`
					}}
					class={`cell ${
						day.count === 0
							? 'bg-gray-200'
							: day.count === 1
							? 'bg-orange/10'
							: day.count === 2
							? 'bg-orange/30'
							: day.count === 3
							? 'bg-orange/55'
							: day.count === 4
							? 'bg-orange/80'
							: 'bg-orange'
						}`}
					style={`grid-column: ${Math.floor(i / 7) + 1}; grid-row: ${(i % 7) + 1};`}
				></div>
				{:else if clientId}
				<div
					use:tooltip={{
						content: `Datum: ${day.key}`
					}}
					class={`cell ${
						day.count === 0
							? 'bg-gray-200'
							: day.date <= today
							? 'bg-orange'
							: 'bg-orange/55'
						}`}
					style={`grid-column: ${Math.floor(i / 7) + 1}; grid-row: ${(i % 7) + 1};`}
				></div>
				{/if}
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
