<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon from '../../../components/bits/icon-component/Icon.svelte';
	import NewsArticle from '../../../components/ui/news/NewsArticle.svelte';
	import NewsComments from '../../../components/ui/news/NewsComments.svelte';
	import NewsSideList from '../../../components/ui/news/NewsSideList.svelte';
	import { headerState } from '$lib/stores/headerState.svelte';
	import { user } from '$lib/stores/userStore';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import type { NewsComment, NewsItem } from '$lib/types/newsTypes';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import { invalidateByPrefix } from '$lib/services/api/apiCache';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let news = $state<NewsItem>(data.news);
	let latest = $state<NewsItem[]>(data.latest ?? []);
	let comments = $state<NewsComment[]>(data.comments ?? []);
	let isUpdatingReaction = $state(false);
	let isDeleting = $state(false);

	let currentUser = $derived($user);
	let canManage = $derived(
		hasRole(['Administrator', 'LocationManager', 'Economy'], currentUser as any)
	);
	let isAdministrator = $derived(hasRole('Administrator', currentUser as any));
	let isWriter = $derived(news?.writer_id === currentUser?.id);
	let canEdit = $derived(isAdministrator || (isWriter && canManage));
	let canDelete = $derived(isAdministrator || (isWriter && canManage));
	let publishedDate = $derived(formatDateTime(news?.published_at || news?.created_at));
	let sideNews = $derived([news, ...latest.filter((item) => item.id !== news.id)].slice(0, 10));

	$effect(() => {
		news = data.news;
		latest = data.latest ?? [];
		comments = data.comments ?? [];
	});

	onMount(() => {
		headerState.title = 'Nyhet';
		headerState.icon = 'Newspaper';
		if (data.didMarkRead) {
			invalidateByPrefix('/api/news');
		}
	});

	function formatDateTime(value: string | null) {
		if (!value) return '';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return value;
		return d.toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
	}

	function syncNews(updated: NewsItem | null) {
		if (!updated) return;
		news = updated;
		latest = latest.map((item) => (item.id === updated.id ? updated : item));
	}

	async function toggleLike() {
		if (isUpdatingReaction) return;
		isUpdatingReaction = true;
		try {
			const res = await fetch(`/api/news/${news.id}/reaction`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ active: !news.has_reacted })
			});
			if (!res.ok) throw new Error(await res.text());
			const updated: NewsItem = await res.json();
			syncNews(updated);
			invalidateByPrefix('/api/news');
		} catch (err: any) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte uppdatera reaktionen',
				description: err?.message
			});
		} finally {
			isUpdatingReaction = false;
		}
	}

	async function deleteNews() {
		if (isDeleting) return;
		if (!window.confirm('Radera nyhet?')) return;

		isDeleting = true;
		try {
			const res = await fetch(`/api/news/${news.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error(await res.text());
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Nyheten raderades',
				description: ''
			});
			invalidateByPrefix('/api/news');
			goto('/news');
		} catch (err: any) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte radera',
				description: err?.message
			});
		} finally {
			isDeleting = false;
		}
	}

	function handleCommentCountChange(count: number) {
		news = { ...news, comment_count: count };
		latest = latest.map((item) => (item.id === news.id ? { ...item, comment_count: count } : item));
	}
</script>

<div class="custom-scrollbar m-4 h-full overflow-y-auto">
	<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
		<div class="flex min-w-0 items-center gap-2">
			<div
				class="bg-text flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
			>
				<Icon icon="Newspaper" size="18px" />
			</div>
			<div class="min-w-0">
				<h2 class="text-text truncate text-3xl font-semibold">Nyhet</h2>
				<p class="text-sm text-gray-500">{publishedDate}</p>
			</div>
		</div>

		<div class="mr-12 flex flex-wrap items-center gap-2 md:mr-0">
			<a
				href="/news"
				class="border-gray text-gray inline-flex h-8 items-center gap-2 rounded-sm border bg-white px-3 text-sm font-semibold shadow-xs transition hover:bg-gray-50"
			>
				<Icon icon="ChevronLeft" size="14px" />
				Alla nyheter
			</a>
			{#if canEdit}
				<a
					href={`/news/${news.id}/edit`}
					class="border-gray text-gray inline-flex h-8 items-center gap-2 rounded-sm border bg-white px-3 text-sm font-semibold shadow-xs transition hover:bg-gray-50"
				>
					<Icon icon="Edit" size="14px" />
					Redigera
				</a>
			{/if}
			{#if canDelete}
				<button
					type="button"
					class="border-gray text-error hover:bg-error/10 hover:text-error-hover inline-flex h-8 items-center gap-2 rounded-sm border bg-white px-3 text-sm font-semibold shadow-xs transition disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500"
					onclick={deleteNews}
					disabled={isDeleting}
				>
					<Icon icon="Trash" size="14px" />
					Ta bort
				</button>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
		<div class="min-w-0 space-y-4">
			<NewsArticle {news} {isUpdatingReaction} onToggleLike={toggleLike} />

			<NewsComments
				newsId={news.id}
				initialComments={comments}
				onCountChange={handleCommentCountChange}
			/>
		</div>

		<aside class="min-w-0">
			<NewsSideList news={sideNews} selectedId={news.id} />
		</aside>
	</div>
</div>
