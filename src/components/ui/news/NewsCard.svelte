<script lang="ts">
	import Icon from '../../bits/icon-component/Icon.svelte';
	import type { NewsItem } from '$lib/types/newsTypes';

	export let news: NewsItem;

	function formatDate(value: string | null) {
		if (!value) return '';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return value;
		return d.toLocaleDateString('sv-SE', { dateStyle: 'medium' });
	}

	function snippet(html: string) {
		const text = html
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
		return text.length > 200 ? `${text.slice(0, 200)}…` : text;
	}
</script>

<a
	href={`/news/${news.id}`}
	class="group block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
>
	<div class="flex items-start justify-between gap-4">
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2 text-xs text-gray-500">
				<span>
					{#if news.published_at}
						{formatDate(news.published_at)}
					{:else}
						{formatDate(news.created_at)}
					{/if}
				</span>
				{#if news.writer_name}
					<span class="text-gray-300">·</span>
					<span>{news.writer_name}</span>
				{/if}
			</div>

			<h3 class="text-text group-hover:text-primary mt-1.5 text-lg font-semibold transition-colors">
				{news.title}
			</h3>

			<p class="mt-2 text-sm leading-relaxed text-gray-600">{snippet(news.text)}</p>

			{#if news.roles?.length}
				<div class="mt-3 flex flex-wrap gap-1.5">
					{#each news.roles as role}
						<span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600"
							>{role}</span
						>
					{/each}
				</div>
			{/if}
		</div>

		<div
			class="group-hover:text-primary flex flex-shrink-0 items-center gap-1 text-gray-400 transition-colors"
		>
			<span class="text-sm font-medium">Läs nyheten</span>
			<Icon icon="ChevronRight" size="16px" />
		</div>
	</div>
</a>
