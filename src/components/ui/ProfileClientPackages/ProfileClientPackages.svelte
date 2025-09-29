<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Table from '../../bits/table/Table.svelte';

	interface ClientPackage {
		id: number;
		article: { id: number | null; name: string };
		customer: { id: number; name: string };
		is_personal: boolean;
		autogiro: boolean;
		frozen_from_date: string | null;
		invoice_numbers: (string | number)[];
		first_payment_date?: string | null;
		remaining_sessions_today: number | null;
		remaining_sessions: number | null;
		used_sessions_total: number;
		total_sessions: number | null;
		is_active: boolean;
	}

	export let clientId: number;

	let loading = true;
	let error: string | null = null;
	let packages: ClientPackage[] = [];

	const headers = [
		{ label: 'Aktivt', key: 'active', width: '90px' },
		{ label: 'Typ', key: 'type' },
		{ label: 'Kund', key: 'customer' },
		{ label: 'Fryst', key: 'frozen' },
		{ label: 'Personligt', key: 'personal' },
		{ label: 'Autogiro', key: 'autogiro' },
		{ label: 'Fakturanummer', key: 'invoices' },
		{ label: 'Saldo', key: 'saldo_today' },
		{ label: 'Bokningar', key: 'bookings' }
	];

	let tableData = [];

	onMount(async () => {
		if (!clientId) {
			loading = false;
			return;
		}

		loading = true;
		error = null;
		try {
			const res = await fetch(`/api/clients/${clientId}/packages`);
			if (!res.ok) throw new Error(await res.text());
			packages = await res.json();
		} catch (err: any) {
			error = err?.message ?? 'Kunde inte hämta paket';
		} finally {
			loading = false;
		}
	});

	function formatBoolean(value: boolean): string {
		return value ? 'Ja' : 'Nej';
	}

	function formatDate(iso?: string | null): string {
		return iso ? new Date(iso).toISOString().slice(0, 10) : '—';
	}

	function formatSaldo(value: number | null): string {
		if (value === null || Number.isNaN(value)) return '—';
		return String(value);
	}

	function invoiceLabel(list: (string | number)[]): string {
		if (!Array.isArray(list) || list.length === 0) return '—';
		return list.join(', ');
	}

	function goToPackage(id: number) {
		goto(`/settings/packages/${id}`);
	}

	function goToCustomer(id: number) {
		goto(`/settings/customers/${id}`);
	}

	$: hasPackages = packages.length > 0;
	$: tableData = packages.map((pkg) => ({
		id: pkg.id,
		active: pkg.is_active ? 'Aktiv' : 'Inaktiv',
		type: [
			{
				type: 'link',
				label: pkg.article?.name ?? 'Okänt paket',
				attrs: { 'data-sveltekit-preload-data': 'hover' },
				action: () => goToPackage(pkg.id)
			}
		],
		customer: [
			{
				type: 'link',
				label: pkg.customer.name,
				attrs: { 'data-sveltekit-preload-data': 'hover' },
				action: () => goToCustomer(pkg.customer.id)
			}
		],
		frozen: pkg.frozen_from_date ? `Ja, från ${formatDate(pkg.frozen_from_date)}` : 'Nej',
		personal: formatBoolean(pkg.is_personal),
		autogiro: formatBoolean(pkg.autogiro),
		invoices: invoiceLabel(pkg.invoice_numbers),
		saldo_today: formatSaldo(pkg.remaining_sessions_today),
		bookings:
			pkg.total_sessions != null
				? `${pkg.used_sessions_total}/${pkg.total_sessions}`
				: String(pkg.used_sessions_total ?? '—')
	}));
</script>

<div class="rounded-lg bg-white p-6 shadow-md">
	<div class="mb-4 flex items-center justify-between">
		<h4 class="text-xl font-semibold">Paket</h4>
	</div>

	{#if loading}
		<p class="text-gray-600">Laddar paket…</p>
	{:else if error}
		<p class="text-red-600">{error}</p>
	{:else if !hasPackages}
		<p class="text-gray-600">Inga paket kopplade till denna klient.</p>
	{:else}
		<Table {headers} data={tableData} sideScrollable={true} />
	{/if}
</div>
