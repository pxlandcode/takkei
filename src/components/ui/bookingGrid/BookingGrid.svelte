<script>
	import { onMount } from 'svelte';
	import { profileStore } from '$lib/stores/profileStore';
	import { tooltip } from '$lib/actions/tooltip';

	export let trainerId;
	export let daysToShow = 365; // Default to 1 year (Can be 31, 180, etc.)
	let trainerBookings = [];

	// ✅ Compute start date based on daysToShow
	const today = new Date();
	const startDate = new Date();
	startDate.setDate(today.getDate() - daysToShow);

	let days = [];
	let months = [];
	let weekStart = new Date(startDate);
	weekStart.setDate(startDate.getDate() - ((weekStart.getDay() + 6) % 7)); // Ensure Monday start

	const weekDays = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'];

	// ✅ Track grid width
	let gridContainer;
	let gridWidth = 0;

	// ✅ Populate days dynamically based on daysToShow
	let monthLoop = null;
	for (let i = 0; i < daysToShow; i++) {
		const date = new Date(weekStart);
		date.setDate(weekStart.getDate() + i);

		if (date.getMonth() !== monthLoop) {
			monthLoop = date.getMonth();
			months.push({
				name: date.toLocaleString('sv-SE', { month: 'short' }),
				index: Math.floor(days.length / 7) + 1 // Adjusted for different lengths
			});
		}

		days.push({ date, count: 0 });
	}

	// ✅ Fetch bookings when component mounts
	onMount(async () => {
		await profileStore.loadUser(trainerId, fetch);
		trainerBookings = profileStore.getBookings(trainerId);
		updateDays();

		// ✅ Get grid width
		if (gridContainer) {
			gridWidth = gridContainer.offsetWidth;
		}
	});

	// ✅ Function to update days with booking counts
	function updateDays() {
		days = days.map((day) => ({
			...day,
			count: trainerBookings.filter((b) => {
				const bookingDate = new Date(b.booking.startTime);
				return bookingDate.toISOString().slice(0, 10) === day.date.toISOString().slice(0, 10);
			}).length
		}));
	}

	// ✅ Recalculate when trainerBookings updates
	$: if (trainerBookings.length) {
		updateDays();
	}
</script>

<div class="max-w-[820px] rounded-lg bg-white p-6 shadow-md">
	<div class="mb-4 flex flex-row items-center justify-between">
		<h4 class="text-xl font-semibold">Bokningar senaste {daysToShow} dagar</h4>
		<div class="flex flex-row items-center gap-[2px]">
			<p class="day-label">0</p>
			<div use:tooltip={{ content: '0 bokningar' }} class="cell bg-gray-200"></div>
			<div use:tooltip={{ content: '1 bokning' }} class="cell bg-orange/10"></div>
			<div use:tooltip={{ content: '2 bokningar' }} class="cell bg-orange/30"></div>
			<div use:tooltip={{ content: '3 bokningar' }} class="cell bg-orange/55"></div>
			<div use:tooltip={{ content: '4 bokningar' }} class="cell bg-orange/80"></div>
			<div use:tooltip={{ content: '5 eller fler bokningar' }} class="cell bg-orange"></div>
			<p class="day-label">5+</p>
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
			style="grid-template-columns: repeat({Math.ceil(daysToShow / 7)}, 12px);"
			bind:this={gridContainer}
		>
			{#each days as day, i}
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
		grid-template-columns: repeat(53, 12px); /* Adjusts based on daysToShow */
		grid-template-rows: repeat(7, 12px);
		gap: 2px;
	}

	.cell {
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}
</style>
