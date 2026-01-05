<script lang="ts">
	import Icon from '../../../components/bits/icon-component/Icon.svelte';
	import Button from '../../../components/bits/button/Button.svelte';
	import QuillViewer from '../../../components/bits/quillViewer/QuillViewer.svelte';
	import NewsForm from '../../../components/ui/news/NewsForm.svelte';
	import { onMount } from 'svelte';
	import { headerState } from '$lib/stores/headerState.svelte';
	import { user } from '$lib/stores/userStore';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import type { NewsItem } from '$lib/types/newsTypes';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import { goto } from '$app/navigation';

	export let data;

	let news: NewsItem = data.news;
	let latest: NewsItem[] = data.latest ?? [];
	let isEditing = false;

	$: currentUser = $user;
	$: isAdmin = hasRole(['Administrator', 'LocationManager', 'Economy'], currentUser);
	$: isWriter = news?.writer_id === currentUser?.id;
	$: canEdit = isAdmin || isWriter;
	$: canDelete = isAdmin || isWriter;

	onMount(() => {
		headerState.title = 'Nyhet';
		headerState.icon = 'Newspaper';
	});

	function formatDate(value: string | null) {
		if (!value) return '';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return value;
		return d.toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
	}

	async function refreshLatest() {
		const res = await fetch('/api/news?latest=1&limit=4');
		if (res.ok) {
			latest = await res.json();
		}
	}

	function handleSaved(event) {
		news = event.detail.news;
		isEditing = false;
		refreshLatest();
	}

	async function deleteNews() {
		try {
			const res = await fetch(`/api/news/${news.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error(await res.text());
			addToast({ type: AppToastType.SUCCESS, message: 'Nyheten raderades' });
			goto('/news');
		} catch (err) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte radera',
				description: err?.message
			});
		}
	}
	$: roles = news?.roles ?? [];
</script>

<div class="custom-scrollbar m-4 h-full overflow-y-auto">
	<div class="mb-4 flex items-center gap-2">
		<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
			<Icon icon="Newspaper" size="18px" />
		</div>
		<h2 class="text-text text-3xl font-semibold">{news.title}</h2>
	</div>

	<div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
		<div class="space-y-4 xl:col-span-2">
			<div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<p class="text-sm text-gray-500">
						Publicerad {formatDate(news.published_at || news.created_at)}
						{#if news.writer_name}
							· {news.writer_name}
						{/if}
					</p>
					{#if roles.length}
						<div class="flex flex-wrap gap-1.5">
							{#each roles as role}
								<span
									class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600"
								>
									{role}
								</span>
							{/each}
						</div>
					{/if}
				</div>

				{#if isEditing}
					<div class="mt-4">
						<NewsForm {news} mode="edit" on:saved={handleSaved} />
					</div>
				{:else}
					<div class="prose mt-4 max-w-none">
						<QuillViewer content={news.text} />
					</div>
				{/if}

				{#if canEdit || canDelete}
					<div class="mt-6 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
						{#if canEdit}
							<Button
								variant="secondary"
								iconLeft="Edit"
								text={isEditing ? 'Avbryt' : 'Redigera'}
								small
								on:click={() => (isEditing = !isEditing)}
							/>
						{/if}
						{#if canDelete}
							<Button
								variant="danger-outline"
								iconLeft="Trash"
								text="Ta bort"
								small
								confirmOptions={{
									title: 'Radera nyhet?',
									description:
										'Är du säker på att du vill radera den här nyheten? Detta kan inte ångras.',
									action: deleteNews,
									actionLabel: 'Radera'
								}}
							/>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<div class="flex flex-col gap-3">
			<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<div class="mb-3 flex items-center justify-between">
					<h4 class="text-text text-sm font-semibold">Senaste nyheter</h4>
					<a
						class="text-primary hover:text-primary-hover text-sm font-medium hover:underline"
						href="/news">Visa alla</a
					>
				</div>
				{#if latest.length === 0}
					<p class="text-sm text-gray-500">Inga aktuella nyheter.</p>
				{:else}
					<div class="space-y-1">
						{#each latest as n (n.id)}
							<a
								href={`/news/${n.id}`}
								class="block rounded-md px-2 py-2 transition hover:bg-gray-50 {n.id === news.id
									? 'bg-primary/5 border-primary border-l-2'
									: ''}"
							>
								<p class="text-text line-clamp-2 text-sm font-medium">{n.title}</p>
								<p class="mt-0.5 text-xs text-gray-400">
									{formatDate(n.published_at || n.created_at)}
								</p>
							</a>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
