<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '../../icon-component/Icon.svelte';
        import Button from '../../button/Button.svelte';
	import StatisticCard from './StatisticCard.svelte';
import {
	getMockTrainerStatistics,
	type TrainerStatisticsResponse,
	type CancellationPeriodKey,
	type CancellationPeriodStats,
	type DebiteradePassPeriodStats
} from '$lib/api/statistics';
import { openPopup } from '$lib/stores/popupStore';
import StatisticsDetailsPopup from './StatisticsDetailsPopup.svelte';

let statistics: TrainerStatisticsResponse | null = null;
let loading = true;

onMount(async () => {
	statistics = await getMockTrainerStatistics();
	loading = false;
});

function openStatisticsPopup() {
	if (!statistics) return;
	openPopup({
		header: 'Detaljerad statistik',
		icon: 'Charts',
		component: StatisticsDetailsPopup,
		maxWidth: '900px',
		props: { statistics }
	});
}

	const cancellationOrder: CancellationPeriodKey[] = ['week', 'month'];

	$: debiteradePassCards = statistics?.debiteradePass?.periods
		? cancellationOrder
				.map((key) => {
					const data = statistics.debiteradePass?.periods?.[key];
					return data ? { key, data } : null;
				})
				.filter((entry): entry is { key: CancellationPeriodKey; data: DebiteradePassPeriodStats } =>
					Boolean(entry)
				)
		: [];
	$: cancellationCards = statistics?.avbokningar
		? cancellationOrder
				.map((key) => {
					const data = statistics.avbokningar?.[key];
					return data ? { key, data } : null;
				})
				.filter((entry): entry is { key: CancellationPeriodKey; data: CancellationPeriodStats } =>
					Boolean(entry)
				)
		: [];
</script>

<div
	class="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
>
	<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
		<div class="flex items-center gap-2">
			<div class="bg-text flex h-6 w-6 items-center justify-center rounded-full text-white">
				<Icon icon="Charts" size="14px" />
			</div>
			<div>
				<h3 class="text-text text-lg font-semibold">Min statistik</h3>
			</div>
		</div>
		<Button
			text="Visa mer statistik"
			variant="secondary"
			small
			iconRight="ChevronRight"
			on:click={openStatisticsPopup}
			aria-haspopup="dialog"
			disabled={loading || !statistics}
		/>
	</div>

	<div class="flex flex-1 flex-col gap-4 text-sm">
		{#if loading}
			<p class="text-gray-medium">Laddar statistik…</p>
		{:else if !statistics}
			<p class="text-gray-medium">Kunde inte läsa in statistik just nu.</p>
		{:else}
			<section class="flex flex-col gap-3">
				<h4 class="text-gray-medium text-sm font-semibold tracking-wide uppercase">
					Debiterbara bokningar
				</h4>
				<div class="grid gap-3 md:grid-cols-3">
					{#each Object.values(statistics.debiterbaraBokningar) as entry (entry.label)}
						<StatisticCard
							label={entry.label}
							value={entry.totalBookings}
							deltaLabel={entry.deltaLabel}
							detailLabel="Pass med OB-tillägg:"
							detailValue={entry.obBookings}
						/>
					{/each}
				</div>
			</section>

			<section class="grid gap-6 md:grid-cols-2">
				<div class="flex flex-col gap-3">
					<h4 class="text-gray-medium text-sm font-semibold tracking-wide uppercase">
						Debiterade pass hittills
					</h4>
					{#if debiteradePassCards.length}
						<div class="grid gap-3 sm:grid-cols-2">
							{#each debiteradePassCards as { key, data } (key)}
								<StatisticCard
									label={data.label}
									value={`${data.hours} h`}
									deltaLabel={data.deltaLabel}
									description="Jämförelseperiod"
								/>
							{/each}
						</div>
					{:else}
						<p class="text-gray-medium text-xs">Ingen statistik att visa ännu.</p>
					{/if}
				</div>

				{#if cancellationCards.length}
					<div class="flex flex-col gap-3">
						<h4 class="text-gray-medium text-sm font-semibold tracking-wide uppercase">
							Avbokningar
						</h4>
						<div class="grid gap-3 sm:grid-cols-2">
							{#each cancellationCards as { key, data } (key)}
								<StatisticCard
									label={data.label}
									value={data.total}
									valueClass="text-3xl"
									deltaLabel={data.deltaLabel}
									detailLabel="Varav sen avbokning:"
									detailValue={data.late}
								/>
							{/each}
						</div>
					</div>
				{/if}
			</section>
		{/if}
	</div>
</div>
