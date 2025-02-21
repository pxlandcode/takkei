<script lang="ts">
	import CalendarModule from '../../ui/calendarModule/CalendarModule.svelte';
	import DashboardHeader from '../../ui/dashboardHeader/DashboardHeader.svelte';
	import { calendarStore } from '$lib/stores/calendarStore';
	import { goto } from '$app/navigation';

	function handleDateSelect(date: Date) {
		// ✅ Update store
		calendarStore.goToWeek(date, fetch);

		const weekStart = new Date(date);
		weekStart.setDate(
			weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 2)
		); // Go to Monday

		const from = weekStart.toISOString().slice(0, 10);
		const to = new Date(weekStart.setDate(weekStart.getDate() + 6)).toISOString().slice(0, 10);

		goto(`/calendar?from=${from}&to=${to}`);
	}
</script>

<div class="flex w-[320px] flex-col gap-4">
	<DashboardHeader />
	<CalendarModule on:dateSelect={(e) => handleDateSelect(e.detail)} />
</div>
