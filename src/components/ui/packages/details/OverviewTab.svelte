<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import Button from '../../../bits/button/Button.svelte';

	export let pkg: any;
	export let fmtKr: (n?: number) => string;
	export let fmtDate: (iso?: string) => string;
	export let isAdmin: boolean = false;

	const dispatch = createEventDispatcher();

	type InfoField = {
		label: string;
		value: string | number | null | undefined;
		href?: string;
		action?: () => void;
	};

	const EMPTY_VALUE = '—';

	function renderValue(value: string | number | null | undefined): string {
		if (value === null || value === undefined) return EMPTY_VALUE;
		if (typeof value === 'string') {
			const trimmed = value.trim();
			return trimmed.length ? trimmed : EMPTY_VALUE;
		}
		return value.toString();
	}

	function dateOnly(value?: string | null) {
		if (!value) return value;
		const match = value.match(/\d{4}-\d{2}-\d{2}/);
		return match ? match[0] : value;
	}

	$: customerFields = [
		{
			label: 'Kund',
			value: pkg.customer?.name,
			href: pkg.customer?.id ? `/settings/customers/${pkg.customer.id}` : undefined
		},
		{
			label: 'Klient',
			value: pkg.client ? `${pkg.client.firstname} ${pkg.client.lastname}` : null,
			href: pkg.client?.id ? `/clients/${pkg.client.id}` : undefined
		},
		{ label: 'Giltigt t.o.m', value: fmtDate(pkg.valid_to) }
	] as InfoField[];

	$: productFields = [
		{ label: 'Produkt', value: `${pkg.article?.name} (${pkg.article?.sessions} pass)` },
		{ label: 'Pris', value: fmtKr(pkg.paid_price) },
		{ label: 'Pris per pass', value: fmtKr(pkg.price_per_session) },
		{ label: 'Autogiro', value: pkg.autogiro ? 'Ja' : 'Nej' }
	] as InfoField[];

	$: sessionFields = [
		{ label: 'Utnyttjade pass', value: `${pkg.used_sessions} / ${pkg.article?.sessions}` },
		{ label: 'Återstående pass', value: pkg.remaining_sessions }
	] as InfoField[];

	$: paymentFields = [
		{ label: 'Första fakturadatum', value: fmtDate(dateOnly(pkg.first_payment_date)) },
		{ label: 'Betalt t.o.m. idag', value: fmtKr(pkg.paid_sum_to_date) },
		{ label: 'Saldo', value: fmtKr(pkg.balance) }
	] as InfoField[];
</script>

<div class="flex flex-col gap-4">
	<!-- Customer & Validity Info -->
	<div class="rounded-sm border border-gray-200 bg-white p-5 shadow-sm">
		<div class="mb-4 flex items-center gap-2">
			<div class="bg-text flex h-8 w-8 items-center justify-center rounded-sm text-white">
				<Icon icon="User" size="16px" />
			</div>
			<h4 class="text-lg font-semibold text-gray-900">Kund & klient</h4>
		</div>
		<div class="grid gap-4 sm:grid-cols-3">
			{#each customerFields as field (field.label)}
				<div>
					<dt class="text-xs font-semibold tracking-wide text-gray-500 uppercase">{field.label}</dt>
					{#if field.href}
						<dd>
							<a class="text-primary text-base font-medium hover:underline" href={field.href}>
								{renderValue(field.value)}
							</a>
						</dd>
					{:else}
						<dd class="text-base font-medium text-gray-800">{renderValue(field.value)}</dd>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Product & Pricing -->
	<div class="rounded-sm border border-gray-200 bg-white p-5 shadow-sm">
		<div class="mb-4 flex items-center gap-2">
			<div class="bg-text flex h-8 w-8 items-center justify-center rounded-sm text-white">
				<Icon icon="Package" size="16px" />
			</div>
			<h4 class="text-lg font-semibold text-gray-900">Produkt & pris</h4>
		</div>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each productFields as field (field.label)}
				<div>
					<dt class="text-xs font-semibold tracking-wide text-gray-500 uppercase">{field.label}</dt>
					<dd class="text-base font-medium text-gray-800">{renderValue(field.value)}</dd>
				</div>
			{/each}
		</div>
	</div>

	<!-- Sessions -->
	<div class="rounded-sm border border-gray-200 bg-white p-5 shadow-sm">
		<div class="mb-4 flex items-center gap-2">
			<div class="bg-text flex h-8 w-8 items-center justify-center rounded-sm text-white">
				<Icon icon="Calendar" size="16px" />
			</div>
			<h4 class="text-lg font-semibold text-gray-900">Pass</h4>
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			{#each sessionFields as field (field.label)}
				<div>
					<dt class="text-xs font-semibold tracking-wide text-gray-500 uppercase">{field.label}</dt>
					<dd class="text-base font-medium text-gray-800">{renderValue(field.value)}</dd>
				</div>
			{/each}
		</div>

		<!-- Progress bar -->
		{#if pkg.article?.sessions && pkg.used_sessions != null}
			<div class="mt-4">
				<div class="mb-1 flex justify-between text-xs text-gray-500">
					<span>Förbrukat</span>
					<span>{Math.round((pkg.used_sessions / pkg.article.sessions) * 100)}%</span>
				</div>
				<div class="h-2 w-full overflow-hidden bg-gray-200">
					<div
						class="bg-primary h-2 transition-all duration-300"
						style="width: {Math.min((pkg.used_sessions / pkg.article.sessions) * 100, 100)}%"
					></div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Invoicing & Payments -->
	<div class="rounded-sm border border-gray-200 bg-white p-5 shadow-sm">
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<div class="bg-text flex h-8 w-8 items-center justify-center rounded-sm text-white">
					<Icon icon="FileText" size="16px" />
				</div>
				<h4 class="text-lg font-semibold text-gray-900">Fakturering</h4>
			</div>
		</div>

		<div class="grid gap-4 sm:grid-cols-3">
			{#each paymentFields as field (field.label)}
				<div>
					<dt class="text-xs font-semibold tracking-wide text-gray-500 uppercase">{field.label}</dt>
					<dd class="text-base font-medium text-gray-800">{renderValue(field.value)}</dd>
				</div>
			{/each}
		</div>

		<!-- Invoice numbers -->
		<div class="mt-4 border-t border-gray-100 pt-4">
			<div class="flex items-center justify-between">
				<dt class="text-xs font-semibold tracking-wide text-gray-500 uppercase">Fakturanummer</dt>
				{#if isAdmin && (!pkg.invoice_numbers || pkg.invoice_numbers.length === 0)}
					<Button
						text="Lägg till"
						icon="Plus"
						variant="tertiary"
						on:click={() => dispatch('addinvoice')}
					/>
				{/if}
			</div>
			<dd class="mt-1 text-base font-medium text-gray-800">
				{#if pkg.invoice_numbers?.length}
					<div class="flex flex-wrap gap-2">
						{#each pkg.invoice_numbers as inv}
							<span class="rounded-sm bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
								{inv}
							</span>
						{/each}
					</div>
				{:else}
					{EMPTY_VALUE}
				{/if}
			</dd>
		</div>

		<!-- Installments -->
		{#if pkg.installments?.length > 0}
			<div class="mt-4 border-t border-gray-100 pt-4">
				<p class="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
					Faktureringstillfällen ({pkg.installments_summary?.count ?? pkg.installments.length})
				</p>
				<div class="space-y-2">
					{#each pkg.installments as i}
						<div class="flex items-center justify-between rounded-sm bg-gray-50 px-3 py-2">
							<span class="text-sm text-gray-600">{i.date}</span>
							<span class="font-medium text-gray-900">{fmtKr(i.sum)}</span>
						</div>
					{/each}
					<div class="flex items-center justify-between border-t border-gray-200 pt-2">
						<span class="font-semibold text-gray-700">Totalt</span>
						<span class="font-semibold text-gray-900"
							>{fmtKr(pkg.installments_summary?.total_sum)}</span
						>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
