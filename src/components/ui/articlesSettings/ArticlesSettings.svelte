<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { TableType } from '$lib/types/componentTypes';
	import Table from '../../bits/table/Table.svelte';
	import Button from '../../bits/button/Button.svelte';
	import Checkbox from '../../bits/checkbox/Checkbox.svelte';
	import { openPopup } from '$lib/stores/popupStore';
	import { loadingStore } from '$lib/stores/loading';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import ArticleFormPopup from './ArticleFormPopup.svelte';
	import ArticleDetailsPopup from './ArticleDetailsPopup.svelte';
	import {
		canDeleteArticle,
		deleteBlockedMessage,
		formatPrice,
		formatValidityRange
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

	let articles: Article[] = [];
	let tableData: TableType = [];
	let isLoading = false;
	let loadError: string | null = null;
	let permissionError: string | null = null;
	let showInactive = false;
	let ready = false;
	let lastShowInactive: boolean | null = null;

	$: showInactive = $page.url.searchParams.get('show_inactive') === 'yes';

	const baseHeaders = [
		{ label: 'Namn', key: 'name' },
		{ label: 'Pris', key: 'price' },
		{ label: 'Pass', key: 'sessions' },
		{ label: 'Giltighetsdatum', key: 'validity' },
		{ label: '', key: 'actions', width: '140px' }
	];

	$: headers = showInactive
		? [{ label: '', key: 'status', width: '60px' }, ...baseHeaders]
		: baseHeaders;

	$: tableData = articles.map((article) => {
		const actions = [
			{
				type: 'button',
				label: '',
				icon: 'Edit',
				variant: 'secondary',
				action: () => openEditPopup(article)
			},
			{
				type: 'button',
				label: '',
				icon: 'Trash',
				variant: 'danger-outline',
				disabled: !canDeleteArticle(article),
				tooltip: !canDeleteArticle(article) ? deleteBlockedMessage(article) : undefined,
				confirmOptions: {
					title: 'Är du säker?',
					actionLabel: 'Ta bort',
					action: () => handleDelete(article)
				}
			}
		];

		return {
			status: [
				{
					type: 'status',
					status: article.active ? 'active' : 'inactive',
					label: article.active ? 'Aktiv' : 'Inaktiv'
				}
			],
			name: [
				{
					type: 'link',
					label: article.name,
					action: () => openViewPopup(article)
				}
			],
			price: formatPrice(article.price),
			sessions: article.sessions,
			validity: formatValidityRange(article.validity_start_date, article.validity_end_date),
			actions
		};
	});

	function sortArticles(list: Article[]) {
		return [...list].sort((a, b) => {
			const leftSessions = a.sessions ?? Number.NEGATIVE_INFINITY;
			const rightSessions = b.sessions ?? Number.NEGATIVE_INFINITY;
			if (leftSessions !== rightSessions) {
				return leftSessions - rightSessions;
			}

			const leftKind = (a.kind ?? '').toLowerCase();
			const rightKind = (b.kind ?? '').toLowerCase();
			if (leftKind !== rightKind) {
				return leftKind.localeCompare(rightKind, undefined, { sensitivity: 'base' });
			}

			return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
		});
	}

	function applyArticleChange(updated: Article) {
		if (!showInactive && !updated.active) {
			articles = articles.filter((article) => article.id !== updated.id);
			return;
		}
		const next = articles.filter((article) => article.id !== updated.id);
		next.push(updated);
		articles = sortArticles(next);
	}

	function handleCreated(event: CustomEvent<{ article: Article }>) {
		const created = event?.detail?.article;
		if (!created) return;
		applyArticleChange(created);
	}

	function handleUpdated(event: CustomEvent<{ article: Article }>) {
		const updated = event?.detail?.article;
		if (!updated) return;
		applyArticleChange(updated);
	}

	function handleDeleted(event: CustomEvent<{ id: number }>) {
		const deletedId = event?.detail?.id;
		if (!deletedId) return;
		articles = articles.filter((article) => article.id !== deletedId);
	}

	function updateShowInactive(checked: boolean) {
		const url = new URL($page.url);
		if (checked) {
			url.searchParams.set('show_inactive', 'yes');
		} else {
			url.searchParams.delete('show_inactive');
		}
		const query = url.searchParams.toString();
		goto(`${url.pathname}${query ? `?${query}` : ''}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	async function loadArticles() {
		isLoading = true;
		loadError = null;
		permissionError = null;
		loadingStore.loading(true, 'Hämtar artiklar...');
		try {
			const res = await fetch(`/api/settings/articles${showInactive ? '?show_inactive=yes' : ''}`);

			if (res.status === 403) {
				permissionError = (await res.text()) || 'No permission: articles';
				articles = [];
				return;
			}

			if (!res.ok) {
				throw new Error('Kunde inte hämta artiklar.');
			}

			articles = await res.json();
		} catch (error) {
			console.error('Failed to fetch articles', error);
			loadError = 'Kunde inte hämta artiklar.';
			articles = [];
		} finally {
			isLoading = false;
			loadingStore.loading(false);
		}
	}

	async function handleDelete(article: Article) {
		if (!canDeleteArticle(article)) return;

		try {
			const res = await fetch(`/api/settings/articles/${article.id}`, { method: 'DELETE' });
			if (!res.ok) {
				let message = 'Kunde inte ta bort artikeln.';
				try {
					const payload = await res.json();
					if (payload?.error) message = payload.error;
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
			await loadArticles();
		} catch (error: any) {
			console.error('Delete failed', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ta bort',
				description: error?.message ?? 'Något gick fel.'
			});
		}
	}

	function openCreatePopup() {
		openPopup({
			header: 'Ny artikel',
			icon: 'Plus',
			component: ArticleFormPopup,
			maxWidth: '700px',
			props: { mode: 'create' },
			listeners: {
				created: handleCreated
			},
			closeOn: ['created']
		});
	}

	function openEditPopup(article: Article) {
		openPopup({
			header: 'Ändra artikel',
			icon: 'Edit',
			component: ArticleFormPopup,
			maxWidth: '700px',
			props: { mode: 'edit', article },
			listeners: {
				updated: handleUpdated
			},
			closeOn: ['updated']
		});
	}

	function openViewPopup(article: Article) {
		openPopup({
			header: article.name,
			icon: 'Package',
			component: ArticleDetailsPopup,
			maxWidth: '700px',
			props: {
				article,
				onEdit: () => openEditPopup(article)
			},
			listeners: {
				deleted: handleDeleted
			},
			closeOn: ['deleted']
		});
	}

	onMount(() => {
		ready = true;
		lastShowInactive = showInactive;
		loadArticles();
	});

	$: if (ready && showInactive !== lastShowInactive) {
		lastShowInactive = showInactive;
		loadArticles();
	}
</script>

<div class="p-5">
	<div class="mb-4 flex flex-row items-center justify-between">
		<h2 class="text-xl font-semibold">Artiklar</h2>
	</div>

	{#if permissionError}
		<p class="text-red-600">{permissionError}</p>
	{:else}
		<div class="custom-scrollbar h-full overflow-x-scroll">
			<div class="my-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<Button text="Lägg till artikel" variant="primary" on:click={openCreatePopup} />

				<Checkbox
					id="show-inactive-products"
					label="Visa även inaktiva artiklar"
					checked={showInactive}
					on:change={(event) => updateShowInactive(event.detail.checked)}
				/>
			</div>

			{#if loadError}
				<p class="text-red-600">{loadError}</p>
			{:else}
				<Table {headers} data={tableData} />
			{/if}

			{#if isLoading}
				<p class="my-4 text-center text-sm text-gray-400">Laddar artiklar...</p>
			{/if}
		</div>
	{/if}
</div>
