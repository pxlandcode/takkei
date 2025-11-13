<script lang="ts">
        import { onMount } from 'svelte';
        import {
                formatDateInputValue,
                getPresetRange,
                getTrainerStatistics,
                type StatisticsPreset,
                type TrainerStatisticsResponse
        } from '$lib/api/statistics';

        export let statistics: TrainerStatisticsResponse | null = null;
        export let trainerId: number | null = null;
        export let fetchFn: typeof fetch = fetch;

        let startDate = '';
        let endDate = '';
        let activePreset: StatisticsPreset | null = 'currentMonth';
        let loading = false;
        let error: string | null = null;
        let currentStatistics: TrainerStatisticsResponse | null = null;

        const fetcher = (input: RequestInfo | URL, init?: RequestInit) => fetchFn(input, init);

        onMount(() => {
                const initialRange = getPresetRange('currentMonth');
                startDate = formatDateInputValue(initialRange.start);
                endDate = formatDateInputValue(initialRange.end);
                currentStatistics = statistics;
        });

        $: if (statistics && !loading) {
                currentStatistics = statistics;
        }

        async function refreshStatistics() {
                if (!trainerId || !startDate || !endDate) return;
                loading = true;
                error = null;
                try {
                        currentStatistics = await getTrainerStatistics(
                                trainerId,
                                { from: startDate, to: endDate },
                                fetcher
                        );
                } catch (err) {
                        console.error('Failed to reload statistics', err);
                        error = 'Kunde inte läsa in statistik.';
                } finally {
                        loading = false;
                }
        }

        function setPreset(preset: StatisticsPreset) {
                activePreset = preset;
                const range = getPresetRange(preset);
                startDate = formatDateInputValue(range.start);
                endDate = formatDateInputValue(range.end);
                refreshStatistics();
        }

        function handleManualDateChange() {
                activePreset = null;
                if (startDate && endDate) {
                        refreshStatistics();
                }
        }

        $: tableRows = currentStatistics?.table.rows ?? [];
        $: tableTotal = currentStatistics?.table.total;
</script>

<div class="flex max-h-[90vh] flex-col gap-4 overflow-y-auto">
	<section class="px-1">
		<h4 class="text-text text-sm font-semibold">Välj period</h4>
		<div class="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div class="flex flex-wrap items-center gap-2 text-sm">
				<label class="text-gray-medium" for="statistics-start">Från</label>
				<input
					id="statistics-start"
					class="text-text focus:border-primary focus:ring-primary rounded border border-gray-200 px-3 py-1 text-sm focus:ring-1 focus:outline-none"
					type="date"
					bind:value={startDate}
					on:change={handleManualDateChange}
				/>
				<label class="text-gray-medium" for="statistics-end">Till</label>
				<input
					id="statistics-end"
					class="text-text focus:border-primary focus:ring-primary rounded border border-gray-200 px-3 py-1 text-sm focus:ring-1 focus:outline-none"
					type="date"
					bind:value={endDate}
					on:change={handleManualDateChange}
				/>
			</div>
			<div class="flex flex-wrap gap-2">
				{#each ['currentWeek', 'currentMonth', 'previousMonth'] as preset}
					<button
						type="button"
						class={`focus-visible:ring-primary/60 rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 ${
							activePreset === preset
								? 'border-primary bg-primary/10 text-primary'
								: 'text-text hover:border-primary/60 border-gray-200'
						}`}
						on:click={() => setPreset(preset as StatisticsPreset)}
						aria-pressed={activePreset === preset}
					>
						{preset === 'currentWeek'
							? 'Denna vecka'
							: preset === 'currentMonth'
								? 'Denna månad'
								: 'Föregående månad'}
					</button>
				{/each}
			</div>
		</div>
	</section>

        <section class="overflow-x-auto">
                {#if loading}
                        <p class="text-gray-medium px-1 text-sm">Hämtar statistik…</p>
                {:else if error}
                        <p class="text-gray-medium px-1 text-sm">{error}</p>
                {:else if !currentStatistics}
                        <p class="text-gray-medium px-1 text-sm">Ingen statistik att visa just nu.</p>
                {:else}
                        <table class="min-w-full divide-y divide-gray-200 text-sm">
                                <thead class="text-gray-medium bg-gray-50 text-left text-xs tracking-wide uppercase">
                                        <tr>
                                                <th scope="col" class="px-3 py-3">Typ</th>
						<th scope="col" class="px-3 py-3">Timmar</th>
						<th scope="col" class="px-3 py-3">Sena avbokningar</th>
						<th scope="col" class="px-3 py-3">Summa OB-tillägg</th>
					</tr>
				</thead>
				<tbody class="text-text divide-y divide-gray-100">
					{#each tableRows as row (row.type)}
						<tr>
							<td class="px-3 py-3 font-medium whitespace-nowrap">{row.type}</td>
							<td class="px-3 py-3">{row.hours}</td>
							<td class="px-3 py-3">{row.lateCancellations}</td>
							<td class="px-3 py-3">{row.obTotal}</td>
						</tr>
					{/each}
                                        {#if tableTotal}
                                                <tr class="bg-gray-50 font-semibold">
                                                        <td class="px-3 py-3">{tableTotal.type}</td>
                                                        <td class="px-3 py-3">{tableTotal.hours}</td>
							<td class="px-3 py-3">{tableTotal.lateCancellations}</td>
							<td class="px-3 py-3">{tableTotal.obTotal}</td>
						</tr>
					{/if}
				</tbody>
			</table>
		{/if}
	</section>
</div>
