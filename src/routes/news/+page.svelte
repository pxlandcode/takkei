<script lang="ts">
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import Button from '../../components/bits/button/Button.svelte';
	import NewsForm from '../../components/ui/news/NewsForm.svelte';
	import NewsCard from '../../components/ui/news/NewsCard.svelte';
	import { onMount } from 'svelte';
	import { headerState } from '$lib/stores/headerState.svelte';
	import { user } from '$lib/stores/userStore';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import type { NewsItem } from '$lib/types/newsTypes';

	export let data;

	let news: NewsItem[] = data.news ?? [];
	let showForm = false;
	let isLoading = false;
	let hasMore = data.news?.length === 5;
	let loadMoreTrigger: HTMLDivElement;

	const PAGE_SIZE = 5;

	$: currentUser = $user;
	$: canManage = hasRole(['Administrator', 'LocationManager', 'Economy'], currentUser);

	onMount(() => {
		headerState.title = 'Nyheter';
		headerState.icon = 'Newspaper';

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !isLoading) {
					loadMore();
				}
			},
			{ rootMargin: '100px' }
		);

		if (loadMoreTrigger) {
			observer.observe(loadMoreTrigger);
		}

		return () => observer.disconnect();
	});

	function startCreate() {
		showForm = true;
	}

	async function loadMore() {
		if (isLoading || !hasMore) return;
		isLoading = true;

		try {
			const offset = news.length;
			const res = await fetch(`/api/news?limit=${PAGE_SIZE}&offset=${offset}`);
			if (res.ok) {
				const moreNews: NewsItem[] = await res.json();
				if (moreNews.length < PAGE_SIZE) {
					hasMore = false;
				}
				news = [...news, ...moreNews];
			}
		} finally {
			isLoading = false;
		}
	}

	function onSaved(event) {
		const saved: NewsItem = event.detail.news;
		news = [saved, ...news];
		showForm = false;
	}
</script>

<div class="custom-scrollbar m-4 h-full overflow-y-auto">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-2">
			<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
				<Icon icon="Newspaper" size="18px" />
			</div>
			<div>
				<h2 class="text-text text-3xl font-semibold">Nyheter</h2>
				<p class="text-sm text-gray-500">{news.length} artiklar</p>
			</div>
		</div>

		{#if canManage}
			<Button
				variant="primary"
				iconLeft="Plus"
				iconLeftSize="16"
				text="Ny nyhet"
				on:click={startCreate}
				small
			/>
		{/if}
	</div>

	{#if showForm && canManage}
		<div class="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-text text-lg font-semibold">Skapa ny nyhet</h3>
				<button
					class="flex items-center justify-center rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
					on:click={() => (showForm = false)}
				>
					<Icon icon="Close" size="18px" />
				</button>
			</div>
			<NewsForm news={null} mode="create" showSendEmail={true} on:saved={onSaved} />
		</div>
	{/if}

	<div class="mx-auto max-w-4xl">
		{#if news.length === 0}
			<div
				class="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 py-16"
			>
				<Icon icon="Newspaper" size="48px" color="#9ca3af" />
				<p class="mt-4 text-gray-500">Det finns inga nyheter att visa</p>
				{#if canManage}
					<button
						class="text-primary hover:text-primary-hover mt-4 text-sm font-medium"
						on:click={startCreate}
					>
						Skapa den första nyheten
					</button>
				{/if}
			</div>
		{:else}
			<div class="flex flex-col gap-4">
				{#each news as item (item.id)}
					<NewsCard news={item} />
				{/each}
			</div>

			<div bind:this={loadMoreTrigger} class="py-4">
				{#if isLoading}
					<div class="flex items-center justify-center gap-2 text-gray-500">
						<Icon icon="Refresh" size="18px" extraClasses="animate-spin" />
						<span class="text-sm">Laddar fler nyheter...</span>
					</div>
				{:else if !hasMore && news.length > 0}
					<p class="text-center text-sm text-gray-400">Inga fler nyheter</p>
				{/if}
			</div>
		{/if}
	</div>
</div>
