<script>
	import { onMount } from 'svelte';
	import { profileStore } from '$lib/stores/profileStore';
	import { tooltip } from '$lib/actions/tooltip';

	export let trainerId;
	let trainerBookings = [];

	// ✅ Define `days` to hold a year's worth of data
	const today = new Date();
	const lastYear = new Date();
	lastYear.setFullYear(today.getFullYear() - 1);

	let days = [];
	let months = [];
	let weekStart = new Date(lastYear);
	weekStart.setDate(lastYear.getDate() - ((weekStart.getDay() + 6) % 7)); // Ensure Monday start

	const weekDays = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'];

	// ✅ Populate `days` with 365 days, mapped to weeks
	let monthLoop = null;
	for (let i = 0; i < 365; i++) {
		const date = new Date(weekStart);
		date.setDate(weekStart.getDate() + i);

		if (date.getMonth() !== monthLoop) {
			monthLoop = date.getMonth();
			months.push({
				name: date.toLocaleString('sv-SE', { month: 'short' }),
				index: Math.floor(days.length / 7) + 1 // Position at week start
			});
		}

		days.push({ date, count: 0 });
	}

	// ✅ Fetch user and bookings when component mounts
	onMount(async () => {
		await profileStore.loadUser(trainerId, fetch);
		trainerBookings = profileStore.getBookings(trainerId);
		updateDays();
	});

	// ✅ Function to update `days` based on `trainerBookings`
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

<div class="rounded-lg bg-white p-6 shadow-md">
	<div class="mb-4 flex flex-row items-center justify-between">
		<h4 class="text-xl font-semibold">Bokningar senaste året</h4>
		<div class="flex flex-row items-center gap-[2px]">
			<p class="day-label">0</p>
			<div
				class="cell bg-gray-200"
				use:tooltip={{
					content: `0 bokningar`
				}}
			></div>
			<div use:tooltip={{ content: '1 bokning' }} class="cell bg-orange/10"></div>
			<div use:tooltip={{ content: '2 bokningar' }} class="cell bg-orange/30"></div>
			<div use:tooltip={{ content: '3 bokningar' }} class="cell bg-orange/55"></div>
			<div use:tooltip={{ content: '4 bokningar' }} class="cell bg-orange/80"></div>
			<div use:tooltip={{ content: '5 eller fler bokningar' }} class="cell bg-orange"></div>
			<p class="day-label">5+</p>
		</div>
	</div>

	<!-- Month Labels -->
	<div class="months">
		{#each months as month}
			<div class="month-label" style="grid-column: {month.index};">{month.name}</div>
		{/each}
	</div>

	<div class="grid-wrapper">
		<!-- Weekday Labels -->
		<div class="weekdays">
			{#each weekDays as day}
				<div class="day-label">{day}</div>
			{/each}
		</div>

		<!-- Booking Grid -->
		<div class="grid-container">
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
	/* Month Labels */
	.months {
		margin-left: 30px;
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		gap: 2px;
		margin-bottom: 5px;
	}

	.month-label {
		font-size: 10px;
		text-align: center;
		color: #888;
	}

	.grid-wrapper {
		display: flex;
	}

	/* Weekday Labels */
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
		grid-template-columns: repeat(53, 12px);
		grid-template-rows: repeat(7, 12px);
		gap: 2px;
	}

	.cell {
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}
</style>
