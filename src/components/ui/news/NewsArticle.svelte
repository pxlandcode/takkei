<script lang="ts">
	import Icon from '../../bits/icon-component/Icon.svelte';
	import QuillViewer from '../../bits/quillViewer/QuillViewer.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import { roleLabel } from '$lib/constants/roles';
	import type { NewsItem } from '$lib/types/newsTypes';

	type Props = {
		news: NewsItem;
		isUpdatingReaction?: boolean;
		onToggleLike?: () => void;
	};

	let { news, isUpdatingReaction = false, onToggleLike }: Props = $props();

	let roles = $derived(news?.roles ?? []);
	let likeTooltip = $derived(news.has_reacted ? 'Gillad' : 'Gilla');
</script>

<article class="rounded-sm border border-gray-200 bg-white shadow-sm">
	<div class="border-b border-gray-100 px-5 py-4">
		<div class="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
			{#if news.pinned}
				<span class="bg-orange/10 text-orange rounded-sm px-2 py-0.5 font-semibold"> Fäst </span>
			{/if}
			<span
				class="rounded-sm px-2 py-0.5 font-semibold {news.read_at
					? 'bg-success/10 text-success'
					: 'bg-error/10 text-error'}"
			>
				{news.read_at ? 'Läst' : 'Oläst'}
			</span>
			{#if news.writer_name}
				<span class="text-gray-300">·</span>
				<span>{news.writer_name}</span>
			{/if}
		</div>

		<h1 class="text-text max-w-4xl text-3xl leading-tight font-semibold">{news.title}</h1>

		{#if roles.length}
			<div class="mt-4 flex flex-wrap gap-1.5">
				{#each roles as role}
					<span class="rounded-sm bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
						{roleLabel(role)}
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<div class="article-body px-5 py-5">
		<QuillViewer content={news.text} />
	</div>

	<div class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
		<div class="flex flex-wrap items-center gap-2 text-sm text-gray-500">
			<span class="inline-flex items-center gap-1" aria-label={`${news.like_count} gillningar`}>
				<Icon icon="ThumbsUp" size="15px" />
				{news.like_count}
			</span>
			<span class="inline-flex items-center gap-1" aria-label={`${news.comment_count} kommentarer`}>
				<Icon icon="Notes" size="15px" />
				{news.comment_count}
			</span>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				class="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-sm font-semibold shadow-xs transition disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500 {news.has_reacted
					? 'border-gray/30 bg-primary hover:bg-primary-hover text-white'
					: 'border-gray text-gray hover:bg-gray-50'}"
				use:tooltip={{ content: likeTooltip, preferred: 'top', delay: 500 }}
				onclick={() => onToggleLike?.()}
				disabled={isUpdatingReaction}
				aria-label={likeTooltip}
			>
				<Icon icon="ThumbsUp" size="14px" />
			</button>
		</div>
	</div>
</article>

<style>
	.article-body :global(.ql-editor) {
		min-height: 0;
		padding: 0;
		font-size: 0.95rem;
		line-height: 1.75;
	}
</style>
