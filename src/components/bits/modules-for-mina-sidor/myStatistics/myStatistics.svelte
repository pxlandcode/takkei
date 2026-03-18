<script lang="ts">
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import Icon from '../../icon-component/Icon.svelte';
	import Button from '../../button/Button.svelte';
	import StatisticCard from './StatisticCard.svelte';
	import {
		type TrainerStatisticsResponse,
		type BookingTimeframeKey,
		type CancellationPeriodKey,
		type DebiteradePassPeriodStats
	} from '$lib/api/statistics';
	import { openPopup } from '$lib/stores/popupStore';
	import { user as userStore } from '$lib/stores/userStore';
	import StatisticsDetailsPopup from './StatisticsDetailsPopup.svelte';
	import { cacheFirstJson } from '$lib/services/api/apiCache';

	export let prefetchedStatistics: TrainerStatisticsResponse | null | undefined = undefined;
	export let variant: 'default' | 'modern' = 'default';
	let statistics: TrainerStatisticsResponse | null = null;
	let loading = true;
	let error: string | null = null;
	let trainerId: number | null = null;

	async function loadStatistics() {
		if (!trainerId) {
			statistics = null;
			loading = false;
			return;
		}

		loading = true;
		error = null;

		try {
			if (prefetchedStatistics) {
				statistics = prefetchedStatistics;
				loading = false;
			}

			const url = `/api/statistics?trainerId=${trainerId}`;
			const { cached, fresh } = cacheFirstJson<TrainerStatisticsResponse>(fetch, url);

			if (cached) {
				statistics = cached;
				loading = false;
			}

			const data = await fresh;
			statistics = data;
		} catch (err) {
			console.error('Failed to load trainer statistics', err);
			statistics = null;
			error = 'Kunde inte läsa in statistik just nu.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		const currentUser = get(userStore);
		trainerId = currentUser?.id ?? null;

		if (trainerId) {
			loadStatistics();
		} else {
			loading = false;
		}

		const unsubscribe = userStore.subscribe((value) => {
			const nextId = value?.id ?? null;
			if (nextId && nextId !== trainerId) {
				trainerId = nextId;
				loadStatistics();
			} else if (!nextId) {
				trainerId = null;
				statistics = null;
			}
		});

		return unsubscribe;
	});

	function openStatisticsPopup() {
		if (!statistics || !trainerId) return;
		openPopup({
			header: 'Detaljerad statistik',
			icon: 'Charts',
			component: StatisticsDetailsPopup,
			maxWidth: '900px',
			props: { statistics, trainerId, fetchFn: fetch }
		});
	}

	const bokningToPeriodKey: Record<BookingTimeframeKey, CancellationPeriodKey | null> = {
		currentWeek: 'week',
		nextWeek: null,
		currentMonth: 'month'
	};

	$: getDebiteradePassForKey = (
		bokningKey: BookingTimeframeKey
	): DebiteradePassPeriodStats | null => {
		const periodKey = bokningToPeriodKey[bokningKey];
		if (!periodKey) return null;
		return statistics?.debiteradePass?.periods?.[periodKey] ?? null;
	};

	type BookingEntry = [
		BookingTimeframeKey,
		TrainerStatisticsResponse['debiterbaraBokningar'][BookingTimeframeKey]
	];

	$: bookingEntries = statistics
		? (Object.entries(statistics.debiterbaraBokningar) as BookingEntry[])
		: [];
</script>

{#if variant === 'modern'}
	<section class="bg-white p-4 shadow-sm">
		<div
			class="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between"
		>
			<h2 class="flex items-center gap-2 text-lg font-semibold text-gray-900">
				<Icon icon="Charts" size="18px" color="primary" />
				Statistik
			</h2>
			<button
				type="button"
				class="text-primary text-sm font-medium hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
				on:click={openStatisticsPopup}
				aria-haspopup="dialog"
				disabled={loading || !statistics}
			>
				Visa all statistik →
			</button>
		</div>

		{#if loading}
			<div class="flex h-32 items-center justify-center">
				<div
					class="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
				></div>
			</div>
		{:else if error}
			<p class="text-sm text-gray-500">{error}</p>
		{:else if !statistics}
			<p class="text-sm text-gray-500">Ingen statistik att visa just nu.</p>
		{:else}
			<section class="flex flex-col gap-3">
				<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{#each bookingEntries as [key, entry] (key)}
						{@const passData = getDebiteradePassForKey(key)}
						<StatisticCard
							variant="modern"
							label={entry.label}
							value={entry.totalBookings}
							deltaLabel={entry.deltaLabel}
							detailLabel="Pass med OB-tillägg:"
							detailValue={entry.obBookings}
						>
							{#if passData}
								<p class="text-xs text-gray-500">
									Debiterade pass hittills:
									<span class="font-medium text-gray-900">{passData.hours}</span>
								</p>
							{/if}
						</StatisticCard>
					{/each}
				</div>
			</section>
		{/if}
	</section>
{:else}
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
			{:else if error}
				<p class="text-gray-medium">{error}</p>
			{:else if !statistics}
				<p class="text-gray-medium">Ingen statistik att visa just nu.</p>
			{:else}
				<section class="flex flex-col gap-3">
					<h4 class="text-gray-medium text-sm font-semibold tracking-wide uppercase">
						Debiterbara bokningar
					</h4>
					<div class="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
						{#each bookingEntries as [key, entry] (key)}
							{@const passData = getDebiteradePassForKey(key)}
							<StatisticCard
								label={entry.label}
								value={entry.totalBookings}
								deltaLabel={entry.deltaLabel}
								detailLabel="Pass med OB-tillägg:"
								detailValue={entry.obBookings}
							>
								{#if passData}
									<p class="text-gray-medium text-xs">
										Debiterade pass hittills: <span class="text-text font-medium"
											>{passData.hours}</span
										>
									</p>
								{/if}
							</StatisticCard>
						{/each}
					</div>
				</section>
			{/if}
		</div>
	</div>
{/if}
