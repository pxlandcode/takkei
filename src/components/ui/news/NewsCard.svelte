<script lang="ts">
	import Icon from '../../bits/icon-component/Icon.svelte';
	import { roleLabel } from '$lib/constants/roles';
	import type { NewsItem } from '$lib/types/newsTypes';

	type Props = {
		news: NewsItem;
		compact?: boolean;
		selected?: boolean;
		rowIndex?: number;
	};

	let { news, compact = false, selected = false, rowIndex = 0 }: Props = $props();

	function formatDate(value: string | null) {
		if (!value) return '';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return value;
		return d.toLocaleDateString('sv-SE', { dateStyle: 'medium' });
	}

	let isUnread = $derived(!news.read_at);
	let date = $derived(formatDate(news.published_at || news.created_at));
	let snippet = $derived(news.snippet || '');
	let rowBackground = $derived(
		selected ? 'bg-orange/5' : rowIndex % 2 === 1 ? 'bg-gray-50' : 'bg-white'
	);
</script>

<a
	href={`/news/${news.id}`}
	data-sveltekit-preload-code="hover"
	data-sveltekit-preload-data="hover"
	class="group block border-b border-gray-100 transition hover:bg-gray-50 {rowBackground} {compact
		? 'px-3 py-3'
		: 'px-4 py-4'}"
	aria-current={selected ? 'page' : undefined}
>
	<div class="min-w-0">
		<div class="flex min-w-0 items-start justify-between gap-3">
			<div class="min-w-0">
				<div class="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
					{#if news.pinned}
						<span class="bg-orange/10 text-orange rounded-sm px-1.5 py-0.5 font-semibold">
							Fäst
						</span>
					{/if}
					{#if isUnread}
						<span class="bg-error/10 text-error rounded-sm px-1.5 py-0.5 font-semibold">
							Oläst
						</span>
					{:else}
						<span class="bg-success/10 text-success rounded-sm px-1.5 py-0.5 font-semibold">
							Läst
						</span>
					{/if}
					{#if news.writer_name}
						<span class="text-gray-300">·</span>
						<span class="truncate">{news.writer_name}</span>
					{/if}
				</div>

				<h3
					class="clamp-2 text-text group-hover:text-primary transition {compact
						? 'text-sm font-semibold'
						: 'text-base font-semibold'}"
				>
					{news.title}
				</h3>
			</div>

			<div class="shrink-0 text-right">
				<p class="text-xs text-gray-500">{date}</p>
				{#if !compact}
					<Icon
						icon="ChevronRight"
						size="16px"
						extraClasses="ml-auto mt-2 text-gray-300 group-hover:text-primary"
					/>
				{/if}
			</div>
		</div>

		{#if !compact && snippet}
			<p class="clamp-2 mt-1.5 text-sm leading-relaxed text-gray-600">{snippet}</p>
		{/if}

		<div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
			<span class="inline-flex items-center gap-1">
				<Icon icon="ThumbsUp" size="13px" />
				{news.like_count}
			</span>
			<span class="inline-flex items-center gap-1">
				<Icon icon="Notes" size="13px" />
				{news.comment_count}
			</span>
			{#if !compact && news.roles?.length}
				<span class="text-gray-300">·</span>
				{#each news.roles as role}
					<span class="rounded-sm bg-gray-100 px-1.5 py-0.5 text-gray-600">
						{roleLabel(role)}
					</span>
				{/each}
			{/if}
		</div>
	</div>
</a>

<style>
	.clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
