<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Table from '../../bits/table/Table.svelte';
	import Button from '../../bits/button/Button.svelte';

	interface ClientPackage {
		id: number;
		article: { id: number | null; name: string };
		customer: { id: number; name: string };
		is_personal: boolean;
		is_shared?: boolean;
		autogiro: boolean;
		frozen_from_date: string | null;
		invoice_numbers: (string | number)[];
		first_payment_date?: string | null;
		remaining_sessions_today: number | null;
		remaining_sessions: number | null;
		used_sessions_total: number;
		used_sessions_until_today?: number;
		total_sessions: number | null;
		is_active: boolean;
		shared_warning?: boolean;
		shared_training_client_count?: number;
	}

	export let clientId: number;

	let loading = true;
	let error: string | null = null;
	let packages: ClientPackage[] = [];
	let recalcPending = false;
	let recalcInfo: string | null = null;
	let recalcError: string | null = null;

	const headers = [
		{ label: 'Aktivt', key: 'active', width: '90px' },
		{ label: 'Typ', key: 'type' },
		{ label: 'Kund', key: 'customer' },
		{ label: 'Fryst', key: 'frozen' },
		{ label: 'Personligt', key: 'personal' },
		// { label: 'Autogiro', key: 'autogiro' },
		{ label: 'Fakturanummer', key: 'invoices' },
		{ label: 'Saldo', key: 'saldo_today' },
		{ label: 'Bokningar', key: 'bookings' }
	];

	let tableData = [];

	async function loadPackages() {
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
	}

	onMount(loadPackages);

	async function recalculateAllClientPackages() {
		if (!clientId) return;
		recalcPending = true;
		recalcInfo = null;
		recalcError = null;
		try {
			const res = await fetch(`/api/clients/${clientId}/packages/recalculate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});

			const text = await res.text();
			let payload: any = null;
			try {
				payload = text ? JSON.parse(text) : null;
			} catch {
				payload = null;
			}

			if (!res.ok) throw new Error(payload?.error || text || 'Kunde inte räkna om paket');

			recalcInfo =
				payload?.message ||
				`Räknade om ${payload?.processedPackages ?? 0} paket och kopplade bort ${payload?.totalDetachedCount ?? 0} bokningar.`;

			await loadPackages();
		} catch (err: any) {
			recalcError = err?.message ?? 'Kunde inte räkna om paket';
		} finally {
			recalcPending = false;
		}
	}

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
				label:
					pkg.shared_warning && !pkg.is_personal
						? `${pkg.customer.name} (Delat: ${pkg.shared_training_client_count ?? 0})`
						: pkg.customer.name,
				attrs: { 'data-sveltekit-preload-data': 'hover' },
				action: () => goToCustomer(pkg.customer.id)
			}
		],
		frozen: pkg.frozen_from_date ? `Ja, från ${formatDate(pkg.frozen_from_date)}` : 'Nej',
		personal: formatBoolean(pkg.is_personal),
		autogiro: formatBoolean(pkg.autogiro),
		invoices: invoiceLabel(pkg.invoice_numbers),
		saldo_today: formatSaldo(pkg.remaining_sessions_today),
		saldo: formatSaldo(pkg.remaining_sessions),
		bookings:
			pkg.total_sessions != null
				? `${pkg.used_sessions_total}/${pkg.total_sessions}`
				: String(pkg.used_sessions_total ?? '—')
	}));
</script>

<div class="rounded-sm bg-white p-6 shadow-md">
	<div class="mb-4 flex items-center justify-between">
		<h4 class="text-xl font-semibold">Paket</h4>
		<Button
			text="Räkna om alla paket"
			icon="Refresh"
			variant="secondary"
			disabled={recalcPending || loading}
			confirmOptions={{
				title: 'Räkna om klientens paket?',
				description:
					'Detta kopplar bort överflödiga eller paketfria bokningar från alla paket som visas i listan.',
				actionLabel: 'Räkna om',
				action: recalculateAllClientPackages
			}}
		/>
	</div>

	{#if recalcInfo}
		<div class="mb-4 rounded-sm border border-green-300 bg-green-50 p-3 text-green-900">
			{recalcInfo}
		</div>
	{/if}
	{#if recalcError}
		<div class="mb-4 rounded-sm border border-red-300 bg-red-50 p-3 text-red-800">
			<strong>Omräkning misslyckades:</strong> {recalcError}
		</div>
	{/if}

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
