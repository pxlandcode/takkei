<script lang="ts">
	import Icon from '../../bits/icon-component/Icon.svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import { invalidateByPrefix } from '$lib/services/api/apiCache';
	import type { NewsComment } from '$lib/types/newsTypes';

	type Props = {
		newsId: number;
		initialComments?: NewsComment[];
		onCountChange?: (count: number) => void;
	};

	let { newsId, initialComments = [], onCountChange }: Props = $props();

	let comments = $state<NewsComment[]>(initialComments);
	let body = $state('');
	let editingId = $state<number | null>(null);
	let editingBody = $state('');
	let isSubmitting = $state(false);
	let currentNewsId = $state(newsId);
	let currentInitialComments = $state(initialComments);

	$effect(() => {
		if (newsId !== currentNewsId) {
			currentNewsId = newsId;
			comments = initialComments;
			body = '';
			editingId = null;
			editingBody = '';
		}
	});

	$effect(() => {
		if (initialComments !== currentInitialComments) {
			currentInitialComments = initialComments;
			comments = initialComments;
		}
	});

	function formatDate(value: string | null) {
		if (!value) return '';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return value;
		return d.toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
	}

	function emitCount() {
		onCountChange?.(comments.length);
	}

	async function addComment() {
		const trimmed = body.trim();
		if (!trimmed || isSubmitting) return;

		isSubmitting = true;
		try {
			const res = await fetch(`/api/news/${newsId}/comments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ body: trimmed })
			});

			if (!res.ok) throw new Error(await res.text());

			const created: NewsComment = await res.json();
			comments = [...comments, created];
			body = '';
			invalidateByPrefix('/api/news');
			emitCount();
		} catch (err: any) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte kommentera',
				description: err?.message ?? 'Okänt fel'
			});
		} finally {
			isSubmitting = false;
		}
	}

	function startEdit(comment: NewsComment) {
		editingId = comment.id;
		editingBody = comment.body;
	}

	function cancelEdit() {
		editingId = null;
		editingBody = '';
	}

	async function saveEdit(comment: NewsComment) {
		const trimmed = editingBody.trim();
		if (!trimmed || isSubmitting) return;

		isSubmitting = true;
		try {
			const res = await fetch(`/api/news/${newsId}/comments/${comment.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ body: trimmed })
			});

			if (!res.ok) throw new Error(await res.text());

			const updated: NewsComment = await res.json();
			comments = comments.map((item) => (item.id === updated.id ? updated : item));
			invalidateByPrefix('/api/news');
			cancelEdit();
		} catch (err: any) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte spara kommentaren',
				description: err?.message ?? 'Okänt fel'
			});
		} finally {
			isSubmitting = false;
		}
	}

	async function deleteComment(comment: NewsComment) {
		if (isSubmitting) return;
		if (!window.confirm('Ta bort kommentar?')) return;

		isSubmitting = true;
		try {
			const res = await fetch(`/api/news/${newsId}/comments/${comment.id}`, {
				method: 'DELETE'
			});

			if (!res.ok) throw new Error(await res.text());

			comments = comments.filter((item) => item.id !== comment.id);
			invalidateByPrefix('/api/news');
			emitCount();
		} catch (err: any) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ta bort kommentaren',
				description: err?.message ?? 'Okänt fel'
			});
		} finally {
			isSubmitting = false;
		}
	}
</script>

<section class="rounded-sm border border-gray-200 bg-white shadow-sm">
	<div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
		<div class="flex items-center gap-2">
			<Icon icon="Notes" size="18px" extraClasses="text-gray-500" />
			<h3 class="text-text font-semibold">Kommentarer</h3>
			<span class="rounded-sm bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
				{comments.length}
			</span>
		</div>
	</div>

	<div class="p-5">
		<div class="mb-5">
			<label for="news-comment" class="mb-2 block text-sm font-medium text-gray-700">
				Skriv kommentar
			</label>
			<textarea
				id="news-comment"
				bind:value={body}
				rows="3"
				placeholder="Lägg till en kort kommentar..."
				class="w-full resize-y rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm text-black transition focus:border-gray-500 focus:outline-hidden"
			></textarea>
			<div class="mt-2 flex justify-end">
				<button
					class="border-gray/30 bg-primary hover:bg-primary-hover inline-flex h-8 items-center gap-2 rounded-sm border px-3 text-sm font-semibold text-white shadow-xs transition disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500"
					onclick={addComment}
					disabled={isSubmitting || !body.trim()}
					type="button"
				>
					<Icon icon="Send" size="14px" />
					{isSubmitting ? 'Skickar...' : 'Kommentera'}
				</button>
			</div>
		</div>

		{#if comments.length === 0}
			<div class="rounded-sm border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
				<p class="text-sm text-gray-500">Inga kommentarer än.</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each comments as comment (comment.id)}
					<article class="rounded-sm border border-gray-100 bg-gray-50 p-4">
						<div class="mb-2 flex items-start justify-between gap-3">
							<div>
								<p class="text-text text-sm font-semibold">
									{comment.user_name ?? 'Okänd tränare'}
								</p>
								<p class="text-xs text-gray-500">{formatDate(comment.created_at)}</p>
							</div>
							{#if comment.can_edit || comment.can_delete}
								<div class="flex shrink-0 items-center gap-1">
									{#if comment.can_edit}
										<button
											type="button"
											class="hover:text-gray inline-flex h-8 w-8 items-center justify-center rounded-sm border border-transparent text-gray-500 transition hover:bg-white"
											onclick={() => startEdit(comment)}
											disabled={isSubmitting}
											aria-label="Redigera kommentar"
										>
											<Icon icon="Edit" size="16px" />
										</button>
									{/if}
									{#if comment.can_delete}
										<button
											type="button"
											class="text-error hover:bg-error/10 hover:text-error-hover inline-flex h-8 w-8 items-center justify-center rounded-sm border border-gray-200 bg-white transition"
											onclick={() => deleteComment(comment)}
											disabled={isSubmitting}
											aria-label="Ta bort kommentar"
										>
											<Icon icon="Trash" size="16px" />
										</button>
									{/if}
								</div>
							{/if}
						</div>

						{#if editingId === comment.id}
							<textarea
								bind:value={editingBody}
								rows="3"
								class="w-full resize-y rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm text-black transition focus:border-gray-500 focus:outline-hidden"
							></textarea>
							<div class="mt-2 flex justify-end gap-2">
								<button
									type="button"
									class="border-gray text-gray inline-flex h-8 items-center rounded-sm border px-3 text-sm font-semibold transition hover:bg-gray-50"
									onclick={cancelEdit}
									disabled={isSubmitting}
								>
									Avbryt
								</button>
								<button
									type="button"
									class="border-gray/30 bg-primary hover:bg-primary-hover inline-flex h-8 items-center gap-2 rounded-sm border px-3 text-sm font-semibold text-white shadow-xs transition disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500"
									onclick={() => saveEdit(comment)}
									disabled={isSubmitting || !editingBody.trim()}
								>
									<Icon icon="Save" size="14px" />
									Spara
								</button>
							</div>
						{:else}
							<p class="text-sm leading-relaxed whitespace-pre-line text-gray-700">
								{comment.body}
							</p>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</div>
</section>
