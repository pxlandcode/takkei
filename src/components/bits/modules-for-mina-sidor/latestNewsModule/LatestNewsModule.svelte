<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '../../icon-component/Icon.svelte';
	import { wrapFetch } from '$lib/services/api/apiCache';

	let news = [];
	let isLoading = true;

	const cachedFetch = wrapFetch(fetch);

	async function loadNews() {
		isLoading = true;
		try {
			const res = await cachedFetch('/api/news?latest=1&limit=4');
			if (res.ok) {
				news = await res.json();
			}
		} finally {
			isLoading = false;
		}
	}

	onMount(loadNews);

	function formatDate(value: string | null) {
		if (!value) return '';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return value;
		return d.toLocaleDateString('sv-SE', { dateStyle: 'medium' });
	}

	function snippet(html: string) {
		const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
		return text.length > 120 ? `${text.slice(0, 120)}…` : text;
	}
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-md">
	<div class="mb-3 flex items-center gap-2">
		<div class="flex h-6 w-6 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="Newspaper" size="14px" />
		</div>
		<h3 class="text-lg font-semibold text-text">Nyheter</h3>
	</div>

	{#if isLoading}
		<p class="text-sm text-gray-500">Laddar nyheter...</p>
	{:else if news.length === 0}
		<p class="text-sm text-gray-500">Inga nyheter senaste månaden.</p>
	{:else}
		<div class="flex flex-col gap-3">
			{#each news as item (item.id)}
				<a
					class="group rounded-sm border border-gray-100 bg-gray-50 px-3 py-2 transition hover:bg-white"
					href={`/news/${item.id}`}
				>
					<div class="flex items-center justify-between">
						<h4 class="text-sm font-semibold text-text group-hover:text-primary">
							{item.title}
						</h4>
						<span class="text-xs text-gray-500">{formatDate(item.published_at || item.created_at)}</span>
					</div>
					<p class="mt-1 text-xs text-gray-600">{snippet(item.text)}</p>
				</a>
			{/each}
		</div>
	{/if}
</div>
