<script>
	import { onMount } from 'svelte';
	import { profileStore } from '$lib/stores/profileStore';
	import { clientProfileStore } from '$lib/stores/clientProfileStore';
	import { tooltip } from '$lib/actions/tooltip';

	export let trainerId = null;
	export let clientId = null;
	export let daysToShow = 365;

	let bookings = [];

	// Calculate date ranges
	const today = new Date();
	const halfRange = Math.floor(daysToShow / 2);

	// Adjust time to start of day to avoid timezone inconsistencies
	today.setHours(0, 0, 0, 0);

	let firstValidDate = new Date(today);
	let lastValidDate = new Date(today);

	if (clientId) {
		// For clients, center the view around today
		firstValidDate.setDate(today.getDate() - halfRange);
		lastValidDate.setDate(today.getDate() + halfRange);
	} else {
		// For trainers, show backwards only
		firstValidDate.setDate(today.getDate() - (daysToShow - 1));
		lastValidDate = new Date(today); // end on today
	}

	// Align to Monday
	let weekStart = new Date(firstValidDate);
	const dayOfWeek = weekStart.getDay(); // 0 = Sunday
	const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
	weekStart.setDate(weekStart.getDate() - daysToSubtract);
	let days = [];
	let months = [];
	const weekDays = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'];

	let gridContainer;
	let gridWidth = 0;

	// Fill the calendar
	let monthLoop = null;
	let currentDate = new Date(weekStart);
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

	// On Mount
	onMount(async () => {
		if (trainerId && clientId) {
			console.warn('Pass only trainerId OR clientId, not both.');
			return;
		}

		if (trainerId) {
			await profileStore.loadUser(trainerId, fetch);
			bookings = profileStore.getBookings(trainerId);
		} else if (clientId) {
			await clientProfileStore.loadClient(clientId, fetch);
			bookings = clientProfileStore.getBookings(clientId);
		} else {
			console.warn('No ID provided for bookings.');
		}

		updateDays();

		if (gridContainer) {
			gridWidth = gridContainer.offsetWidth;
		}
	});

	// Update day counts
	function updateDays() {
		if (bookings.length === 0) return;

		days = days.map((day) => {
			if (day.count === null) return day;

			const bookingCount = bookings.filter((b) => {
				const bookingDate = new Date(b.booking.startTime);
				return bookingDate.toISOString().slice(0, 10) === day.date.toISOString().slice(0, 10);
			}).length;

			return { ...day, count: bookingCount };
		});
	}

	$: if (bookings.length) {
		updateDays();
	}
</script>

<div class="max-w-[820px] rounded-lg bg-white p-6 shadow-md">
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
			style="grid-template-columns: repeat({Math.ceil(days.length / 7)}, 12px);"
			bind:this={gridContainer}
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
							content: `Datum: ${day.date.toISOString().slice(0, 10)}, Bokningar: ${day.count}`
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
							content: `Datum: ${day.date.toISOString().slice(0, 10)} ${trainerId ? `, Bokningar: ${day.count}` : ''}`
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
		grid-template-columns: repeat(53, 12px); /* Adjusts based on days.length */
		grid-template-rows: repeat(7, 12px);
		gap: 2px;
	}

	.cell {
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}
</style>
