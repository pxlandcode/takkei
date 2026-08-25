<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import FilterOptions from '../../components/bits/filterOptions/FilterOptions.svelte';
	import NewsCard from '../../components/ui/news/NewsCard.svelte';
	import { headerState } from '$lib/stores/headerState.svelte';
	import { user } from '$lib/stores/userStore';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import { wrapFetch } from '$lib/services/api/apiCache';
	import type { NewsFilter, NewsItem } from '$lib/types/newsTypes';
	import type { PageData } from './$types';

	type NewsFilterOption = {
		value: NewsFilter;
		label: string;
		icon: string;
		count?: number | null;
	};

	let { data }: { data: PageData } = $props();

	const PAGE_SIZE = 20;
	const baseFilterOptions: NewsFilterOption[] = [
		{ value: 'all', label: 'Alla', icon: 'Newspaper' },
		{ value: 'unread', label: 'Olästa', icon: 'EyeOff' },
		{ value: 'pinned', label: 'Fästa', icon: 'StarCircle' }
	];

	let news = $state<NewsItem[]>(data.news ?? []);
	let selectedFilter = $state<NewsFilter>(data.filter ?? 'all');
	let isLoading = $state(false);
	let hasMore = $state((data.news ?? []).length === PAGE_SIZE);
	let loadMoreTrigger = $state<HTMLDivElement | null>(null);
	let scrollContainer = $state<HTMLDivElement | null>(null);
	let currentDataFilter = $state<NewsFilter>(data.filter ?? 'all');

	let currentUser = $derived($user);
	let canManage = $derived(
		hasRole(['Administrator', 'LocationManager', 'Economy'], currentUser as any)
	);
	let unreadCount = $derived(news.filter((item) => !item.read_at).length);
	let pinnedCount = $derived(news.filter((item) => item.pinned).length);
	let filterOptions = $derived(
		baseFilterOptions.map((option) => {
			if (option.value === 'unread') return { ...option, count: unreadCount };
			if (option.value === 'pinned') return { ...option, count: pinnedCount };
			return option;
		})
	);
	let emptyLabel = $derived(
		selectedFilter === 'unread'
			? 'Det finns inga olästa nyheter.'
			: selectedFilter === 'pinned'
				? 'Det finns inga fästa nyheter.'
				: 'Det finns inga nyheter att visa.'
	);

	$effect(() => {
		const nextFilter = data.filter ?? 'all';
		if (nextFilter !== currentDataFilter) {
			currentDataFilter = nextFilter;
			selectedFilter = nextFilter;
			news = data.news ?? [];
			hasMore = news.length === PAGE_SIZE;
			isLoading = false;
		}
	});

	onMount(() => {
		headerState.title = 'Nyheter';
		headerState.icon = 'Newspaper';
	});

	$effect(() => {
		if (!scrollContainer || !loadMoreTrigger) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !isLoading) {
					loadMore();
				}
			},
			{ root: scrollContainer, rootMargin: '180px 0px' }
		);

		observer.observe(loadMoreTrigger);
		return () => observer.disconnect();
	});

	async function selectFilter(value: string) {
		const filter = value as NewsFilter;
		if (selectedFilter === filter || isLoading) return;

		selectedFilter = filter;
		news = [];
		hasMore = true;
		isLoading = true;

		await goto(filter === 'all' ? '/news' : `/news?filter=${filter}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});

		isLoading = false;
	}

	async function loadNews(reset = false) {
		if (isLoading || (!hasMore && !reset)) return;
		isLoading = true;

		try {
			const offset = reset ? 0 : news.length;
			const res = await wrapFetch(fetch)(
				`/api/news?limit=${PAGE_SIZE}&offset=${offset}&filter=${selectedFilter}`
			);
			if (res.ok) {
				const rows: NewsItem[] = await res.json();
				news = reset ? rows : [...news, ...rows];
				hasMore = rows.length === PAGE_SIZE;
			}
		} finally {
			isLoading = false;
		}
	}

	async function loadMore() {
		await loadNews(false);
	}
</script>

<div bind:this={scrollContainer} class="custom-scrollbar m-4 flex h-full flex-col overflow-y-auto">
	<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
		<div class="flex items-center gap-2">
			<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
				<Icon icon="Newspaper" size="18px" />
			</div>
			<div>
				<h2 class="text-text text-3xl font-semibold">Nyheter</h2>
				<p class="text-sm text-gray-500">
					{news.length} artiklar
					{#if unreadCount > 0}
						· {unreadCount} olästa i listan
					{/if}
				</p>
			</div>
		</div>

		{#if canManage}
			<a
				href="/news/new"
				class="border-gray/30 bg-primary hover:bg-primary-hover inline-flex h-8 items-center gap-2 rounded-sm border px-3 text-sm font-semibold text-white shadow-xs transition"
			>
				<Icon icon="Plus" size="16px" />
				Ny nyhet
			</a>
		{/if}
	</div>

	<div class="mb-4 rounded-sm border border-gray-200 bg-white p-3 shadow-sm">
		<FilterOptions
			options={filterOptions}
			value={selectedFilter}
			onSelect={selectFilter}
			label="Filtrera nyheter"
		/>
	</div>

	<div class="min-h-0 rounded-sm border border-gray-200 bg-white shadow-sm">
		{#if news.length === 0 && !isLoading}
			<div class="flex flex-col items-center justify-center px-4 py-16 text-center">
				<Icon icon="Newspaper" size="42px" extraClasses="text-gray-300" />
				<p class="mt-4 text-sm text-gray-500">{emptyLabel}</p>
				{#if canManage && selectedFilter === 'all'}
					<a
						href="/news/new"
						class="text-primary hover:text-primary-hover mt-4 text-sm font-semibold hover:underline"
					>
						Skapa den första nyheten
					</a>
				{/if}
			</div>
		{:else}
			<div>
				{#each news as item, index (item.id)}
					<NewsCard news={item} rowIndex={index} />
				{/each}

				<div bind:this={loadMoreTrigger} class="border-t border-gray-100 px-4 py-4">
					{#if isLoading}
						<div class="flex items-center justify-center gap-2 text-gray-500">
							<Icon icon="Refresh" size="18px" extraClasses="animate-spin" />
							<span class="text-sm">Laddar fler nyheter...</span>
						</div>
					{:else if !hasMore && news.length > 0}
						<p class="text-center text-sm text-gray-400">Inga fler nyheter</p>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
