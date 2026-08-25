<script lang="ts">
	import Icon from '../../bits/icon-component/Icon.svelte';
	import NewsCard from './NewsCard.svelte';
	import type { NewsItem } from '$lib/types/newsTypes';

	type Props = {
		news: NewsItem[];
		selectedId: number;
		title?: string;
		viewAllHref?: string;
	};

	let { news, selectedId, title = 'Nyhetslista', viewAllHref = '/news' }: Props = $props();
</script>

<div class="sticky top-0 rounded-sm border border-gray-200 bg-white shadow-sm">
	<div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
		<div class="flex items-center gap-2">
			<Icon icon="HistoryList" size="17px" extraClasses="text-gray-500" />
			<h3 class="text-text text-sm font-semibold">{title}</h3>
		</div>
		<a
			href={viewAllHref}
			class="text-primary hover:text-primary-hover text-xs font-semibold hover:underline"
		>
			Visa alla
		</a>
	</div>

	{#if news.length === 0}
		<p class="px-4 py-5 text-sm text-gray-500">Inga aktuella nyheter.</p>
	{:else}
		<div class="custom-scrollbar max-h-[70vh] overflow-y-auto">
			{#each news as item, index (item.id)}
				<NewsCard news={item} compact selected={item.id === selectedId} rowIndex={index} />
			{/each}
		</div>
	{/if}
</div>
