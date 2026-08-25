<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon from '../../../../components/bits/icon-component/Icon.svelte';
	import NewsForm from '../../../../components/ui/news/NewsForm.svelte';
	import { headerState } from '$lib/stores/headerState.svelte';
	import { user } from '$lib/stores/userStore';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import type { NewsItem } from '$lib/types/newsTypes';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let news = $derived(data.news);
	let currentUser = $derived($user);
	let canManage = $derived(
		hasRole(['Administrator', 'LocationManager', 'Economy'], currentUser as any)
	);
	let isAdministrator = $derived(hasRole('Administrator', currentUser as any));
	let isWriter = $derived(news?.writer_id === currentUser?.id);
	let canEdit = $derived(isAdministrator || (isWriter && canManage));

	onMount(() => {
		headerState.title = 'Redigera nyhet';
		headerState.icon = 'Newspaper';
	});

	function handleSaved(saved: NewsItem) {
		goto(`/news/${saved?.id ?? news.id}`);
	}
</script>

<div class="custom-scrollbar m-4 h-full overflow-y-auto">
	<div class="mb-4 flex items-center gap-2">
		<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
			<Icon icon="Edit" size="18px" />
		</div>
		<div>
			<h2 class="text-text text-3xl font-semibold">Redigera nyhet</h2>
			<p class="text-sm text-gray-500">{news.title}</p>
		</div>
	</div>

	<div class="mx-auto max-w-5xl">
		{#if canEdit}
			<NewsForm {news} mode="edit" cancelHref={`/news/${news.id}`} onSaved={handleSaved} />
		{:else}
			<div class="rounded-sm border border-gray-200 bg-white p-8 text-center shadow-sm">
				<Icon icon="Lock" size="36px" extraClasses="mx-auto text-gray-300" />
				<p class="mt-4 text-sm text-gray-500">Du har inte behörighet att redigera nyheten.</p>
				<a
					href={`/news/${news.id}`}
					class="text-primary hover:text-primary-hover mt-4 inline-flex items-center gap-2 text-sm font-semibold hover:underline"
				>
					<Icon icon="ChevronLeft" size="14px" />
					Till nyheten
				</a>
			</div>
		{/if}
	</div>
</div>
