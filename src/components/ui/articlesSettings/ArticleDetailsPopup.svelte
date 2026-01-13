<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { goto } from '$app/navigation';
	import Button from '../../bits/button/Button.svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import { closePopup } from '$lib/stores/popupStore';
	import {
		canDeleteArticle,
		formatPriceWithCurrency,
		formatValidityRange,
		kindLabel
	} from '$lib/utils/articleUtils';

	type Article = {
		id: number;
		name: string;
		price: string;
		sessions: number | null;
		validity_start_date: string | null;
		validity_end_date: string | null;
		kind: string | null;
		active: boolean;
		packages_count: number;
		memberships_count: number;
	};

	export let article: Article;
	export let onEdit: (() => void) | null = null;

	const dispatch = createEventDispatcher();

	$: canDelete = canDeleteArticle(article);
	function statusBadgeClasses(active: boolean) {
		return active
			? 'bg-green-100 text-green-700'
			: 'bg-yellow-100 text-yellow-800 border border-yellow-300';
	}

	function openCustomers() {
		closePopup();
		goto(`/reports/products?article_filter=${article.id}`);
	}

	async function handleDelete() {
		if (!canDelete) return;

		try {
			const res = await fetch(`/api/settings/articles/${article.id}`, { method: 'DELETE' });
			if (!res.ok) {
				let message = 'Kunde inte ta bort artikeln.';
				try {
					const data = await res.json();
					if (data?.error) message = data.error;
				} catch {
					// ignore
				}
				throw new Error(message);
			}

			addToast({
				type: AppToastType.SUCCESS,
				message: 'Artikeln togs bort',
				description: article.name
			});
			dispatch('deleted', { id: article.id });
		} catch (error: any) {
			console.error('Delete failed', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ta bort',
				description: error?.message ?? 'Något gick fel.'
			});
		}
	}
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center gap-2">
		<Button text="Kunder med artikeln" variant="secondary" on:click={openCustomers} />
		<Button text="Ändra" variant="primary" on:click={() => onEdit?.()} />
		{#if canDelete}
			<Button
				text="Ta bort"
				variant="danger-outline"
				confirmOptions={{
					title: 'Är du säker?',
					actionLabel: 'Ta bort',
					action: handleDelete
				}}
			/>
		{/if}
	</div>

	<div class="space-y-2">
		<div class="flex items-center gap-2">
			<span
				class={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
					statusBadgeClasses(article.active)
				}`}
			>
				{article.active ? 'Aktiv' : 'Inaktiv'}
			</span>
		</div>
		<p><strong>Pris:</strong> {formatPriceWithCurrency(article.price)}</p>
		<p><strong>Typ:</strong> {kindLabel(article.kind)}</p>
		{#if article.sessions != null}
			<p><strong>Antal pass:</strong> {article.sessions}</p>
		{/if}
		{#if article.validity_start_date}
			<p>
				<strong>Giltighetstid:</strong>
				{formatValidityRange(article.validity_start_date, article.validity_end_date)}
			</p>
		{/if}
	</div>
</div>
