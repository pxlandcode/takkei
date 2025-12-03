<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	export let pkg: any;
	export let fmtKr: (n?: number) => string;
	export let fmtDate: (iso?: string) => string;
	export let isAdmin: boolean = false;

	const dispatch = createEventDispatcher();
</script>

<div class="space-y-2">
	<p><strong>Kund:</strong> {pkg.customer.name}</p>
	<p>
		<strong>Klient:</strong>
		{pkg.client ? `${pkg.client.firstname} ${pkg.client.lastname}` : '–'}
	</p>
	<p><strong>Giltigt t.o.m:</strong> {fmtDate(pkg.valid_to)}</p>

	<p><strong>Produkt:</strong> {pkg.article.name} ({pkg.article.sessions} pass)</p>
	<p><strong>Pris:</strong> {fmtKr(pkg.paid_price)}</p>
	<p><strong>Pris per pass:</strong> {fmtKr(pkg.price_per_session)}</p>
	<p><strong>Första fakturadatum:</strong> {fmtDate(pkg.first_payment_date)}</p>
	<p><strong>Autogiro:</strong> {pkg.autogiro ? 'Ja' : 'Nej'}</p>

	<p>
		<strong>Fakturanummer:</strong>
		{#if pkg.invoice_numbers?.length}
			{pkg.invoice_numbers.join(', ')}
		{:else if isAdmin}
			— <button class="ml-2 text-blue-600 underline" on:click={() => dispatch('addinvoice')}>Lägg till</button>
		{:else}
			—
		{/if}
	</p>

	<p><strong>Utnyttjade pass:</strong> {pkg.used_sessions} / {pkg.article.sessions}</p>
	<p><strong>Återstående pass:</strong> {pkg.remaining_sessions}</p>
	<p>
		<strong>Pass per betalning:</strong>
		{pkg.passes_per_payment != null ? pkg.passes_per_payment.toFixed(2) : '—'}
	</p>

	<div class="mt-4">
		<p><strong>Faktureringstillfällen ({pkg.installments_summary.count}):</strong></p>
		<ul class="list-inside list-disc">
			{#each pkg.installments as i}
				<li>{fmtKr(i.sum)} <span class="text-gray-500">({i.date})</span></li>
			{/each}
		</ul>
		<p class="mt-2"><strong>Totalt:</strong> {fmtKr(pkg.installments_summary.total_sum)}</p>
	</div>

	<div class="mt-2">
		<p><strong>Betalt t.o.m. idag:</strong> {fmtKr(pkg.paid_sum_to_date)}</p>
		<p><strong>Saldo:</strong> {fmtKr(pkg.balance)}</p>
	</div>
</div>
