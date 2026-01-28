<script lang="ts">
	export let repeatedBookings: any[] = [];
	export let conflictsTitle = 'Konflikter';
	export let readyTitle = 'Bokningar klara att bokas:';
	export let showCounts = true;
	export let showReadyTitle = true;
	let conflicts: any[] = [];
	let ready: any[] = [];

	$: conflicts = repeatedBookings.filter((booking) => booking?.conflict);
	$: ready = repeatedBookings.filter((booking) => !booking?.conflict);
</script>

{#if repeatedBookings.length > 0}
	<div class="flex flex-col gap-2 rounded-sm border border-gray-300 bg-gray-50 p-4">
		{#if conflicts.length > 0}
			<h3 class="flex items-center justify-between text-lg font-semibold">
				{conflictsTitle}
				{#if showCounts}
					<span class="text-sm text-gray-600">
						{conflicts.length} konflikter / {repeatedBookings.length} veckor
					</span>
				{/if}
			</h3>
		{/if}

		{#each conflicts as week (week.week ?? week.date ?? week)}
			<slot name="conflict" {week} />
		{/each}

		{#if showReadyTitle}
			<h3 class="text-lg font-semibold">{readyTitle}</h3>
		{/if}

		{#each ready as week (week.week ?? week.date ?? week)}
			<slot name="ready" {week} />
		{/each}
	</div>
{/if}
