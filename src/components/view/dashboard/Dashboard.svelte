<script lang="ts">
	import CalendarModule from '../../ui/calendarModule/CalendarModule.svelte';
	import DashboardHeader from '../../ui/dashboardHeader/DashboardHeader.svelte';
	import { calendarStore, getWeekStartAndEnd } from '$lib/stores/calendarStore';
	import { goto } from '$app/navigation';

	async function handleDateSelect(date: Date) {
		// ✅ Update store

		date.setHours(2, 0, 0, 0); // Reset time to midnight
		calendarStore.goToWeek(date, fetch);

		const { weekStart, weekEnd } = getWeekStartAndEnd(date);

		goto(`/calendar?from=${weekStart}&to=${weekEnd}`);
	}
</script>

<div class="flex w-[320px] flex-col gap-4">
	<DashboardHeader />
	<CalendarModule on:dateSelect={(e) => handleDateSelect(e.detail)} />
</div>
