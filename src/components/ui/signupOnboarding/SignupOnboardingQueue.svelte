<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { TableType } from '$lib/types/componentTypes';
	import Table from '../../bits/table/Table.svelte';

	export let search = '';
	export let status: 'active' | 'inactive' | 'all' = 'active';

	const headers = [
		{ label: 'Registrerad', key: 'created', width: '112px' },
		{ label: 'Klient', key: 'client', width: '180px', stacked: true },
		{ label: 'Paket / betalning', key: 'package', width: '200px', stacked: true },
		{ label: 'Status', key: 'status', width: '88px' },
		{ label: '', key: 'actions', width: '86px' }
	];

	let rows: TableType = [];
	let loading = true;
	let error = '';
	let mounted = false;
	let requestVersion = 0;
	let lastQuery = '';

	function formatDate(value: string) {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		}).format(new Date(value));
	}

	function statusLabel(status: string) {
		return (
			{
				new: 'Ny',
				in_progress: 'Pågående',
				waiting: 'Väntar'
			}[status] ?? status
		);
	}

	function statusVariant(status: string) {
		if (status === 'new') return 'danger';
		if (status === 'waiting') return 'warning';
		if (status === 'completed') return 'success';
		if (status === 'cancelled') return 'neutral';
		return 'info';
	}

	function paymentLabel(payload: any) {
		if (payload?.existingPackage) return 'Befintligt paket';
		const payer = payload?.paymentChoice === 'company' ? 'Företag' : 'Privat';
		return `${payer}${payload?.autogiro ? ' · Autogiro' : ''}`;
	}

	function mapRows(cases: any[]): TableType {
		return cases.map((item) => {
			const payload = item.submitted_payload ?? {};
			const name = `${payload.firstname ?? ''} ${payload.lastname ?? ''}`.trim();
			return {
				id: item.id,
				created: formatDate(item.created_at),
				client: [
					{
						type: 'link',
						label: name || `Registrering ${item.id}`,
						action: () => goto(`/clients/onboarding/${item.id}`)
					},
					...(item.has_duplicate_warning ? [{ type: 'text', content: 'Möjlig dubblett' }] : [])
				],
				package: [
					{ type: 'text', content: payload.selectedTrainingPackage || 'Ej valt' },
					{ type: 'text', content: paymentLabel(payload) }
				],
				status: [
					{
						type: 'pill',
						label: statusLabel(item.status),
						variant: statusVariant(item.status)
					}
				],
				actions: [
					{
						type: 'button',
						label: 'Öppna',
						icon: 'ChevronRight',
						variant: 'primary',
						action: () => goto(`/clients/onboarding/${item.id}`)
					}
				]
			};
		});
	}

	async function loadCases() {
		const params = new URLSearchParams({ limit: '100' });
		if (search.trim()) params.set('search', search.trim());
		if (status === 'inactive') params.set('status', 'completed,cancelled');
		else if (status === 'all') {
			params.set('status', 'new,in_progress,waiting,completed,cancelled');
		}
		const query = params.toString();
		if (query === lastQuery && rows.length) return;
		lastQuery = query;
		const version = ++requestVersion;
		loading = true;
		error = '';
		try {
			const response = await fetch(`/api/onboarding?${query}`, { cache: 'no-store' });
			if (!response.ok) throw new Error('Kunde inte hämta registreringar');
			const result = await response.json();
			if (version === requestVersion) rows = mapRows(result.cases ?? []);
		} catch (caught) {
			if (version === requestVersion) {
				error = caught instanceof Error ? caught.message : 'Något gick fel';
				rows = [];
			}
		} finally {
			if (version === requestVersion) loading = false;
		}
	}

	onMount(() => {
		mounted = true;
		void loadCases();
	});

	$: if (mounted) {
		search;
		status;
		void loadCases();
	}
</script>

<div>
	{#if error}
		<div class="rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
	{:else if loading}
		<p class="py-8 text-center text-sm text-gray-500">Laddar registreringar...</p>
	{:else if rows.length === 0}
		<div class="rounded-sm border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
			Inga registreringar hittades.
		</div>
	{:else}
		<Table {headers} data={rows} noSelect />
	{/if}
</div>
