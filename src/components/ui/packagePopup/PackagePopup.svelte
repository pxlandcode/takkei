<script lang="ts">
	import { onMount } from 'svelte';

	import {
		createPackage,
		getArticles,
		getClientsForCustomer
	} from '$lib/services/api/packageService';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import Input from '../../bits/Input/Input.svelte';
	import Checkbox from '../../bits/checkbox/Checkbox.svelte';
	import Button from '../../bits/button/Button.svelte';

	export let onSave;
	export let customerId: number = null;

	let customerLocked = customerId !== null;

	let articles = [];
	let customers = [];
	let clients = [];

	let selectedArticleId = '';
	let selectedCustomerId = '';
	let selectedClientId = '';

	let price = '';
        let invoiceNumber = '';
        let invoiceNumbers: number[] = [];
	let firstPaymentDate = '';
	let autogiro = false;
	let installments = 1;
	let priceLocked = true;
	let breakdownLocked = true;

	let selectedArticle = null;
	let selectedCustomer = null;

        let installmentBreakdown: { date: string; sum: number; invoice_no?: string }[] = [];

	const today = new Date();
	const defaultDate = new Date(today.getFullYear(), today.getMonth() + 1, 25);
	firstPaymentDate = defaultDate.toISOString().split('T')[0];

	onMount(async () => {
		const res = await fetch('/api/customers?short=true');
		customers = await res.json();
		articles = await getArticles();

		if (customerId) {
			selectedCustomerId = customerId;
			selectedCustomer = customers.find((c) => c.id === customerId) ?? null;
			await loadClientsForCustomer(customerId);
		}
	});

	$: if (selectedArticleId) {
		selectedArticle = articles.find((a) => a.id === Number(selectedArticleId)) ?? null;
	}
	$: if (selectedCustomerId) {
		selectedCustomer = customers.find((c) => c.id === Number(selectedCustomerId)) ?? null;
	}

	$: if (selectedArticle && priceLocked) price = selectedArticle.price;

	async function loadClientsForCustomer(id) {
		const res = await getClientsForCustomer(id);
		clients = res;
		selectedClientId = '';
	}

	$: if (firstPaymentDate && installments > 0 && !isNaN(parseFloat(price)))
		generateInstallmentDates();
	$: if (!firstPaymentDate || !installments || isNaN(parseFloat(price))) installmentBreakdown = [];

        function generateInstallmentDates() {
                const total = parseFloat(price || '0');
                const evenSum = total / installments;
                let remainder = total;
                installmentBreakdown = Array.from({ length: installments }, (_, i) => {
                        const date = new Date(firstPaymentDate);
                        date.setMonth(date.getMonth() + i);
                        const formattedDate = date.toISOString().split('T')[0];

                        let sum = i === installments - 1 ? remainder : parseFloat(evenSum.toFixed(2));
                        remainder = parseFloat((remainder - sum).toFixed(2));

                        return { date: formattedDate, sum: Number(sum.toFixed(2)) };
                });
        }

	let errors = {};

	async function save() {
		errors = {}; // clear previous errors

		if (!selectedArticle || !selectedCustomer) {
			if (!selectedArticle) errors.articleId = 'Produkt måste väljas';
			if (!selectedCustomer) errors.customerId = 'Kund måste väljas';
			return;
		}

                const breakdownTotal = installmentBreakdown.reduce((sum, i) => sum + Number(i.sum || 0), 0);
                const priceValue = parseFloat(price);

                if (Number.isNaN(priceValue)) {
                        errors.price = 'Pris måste anges';
                        return;
                }

                if (installmentBreakdown.length === 0 || installments !== installmentBreakdown.length) {
                        errors.installments = 'Antal faktureringstillfällen måste stämma.';
                        return;
                }

                if (Number.isNaN(breakdownTotal) || Math.abs(breakdownTotal - priceValue) > 0.01) {
                        errors.installmentBreakdown = 'Summan av faktureringstillfällena måste matcha paketpriset.';
                        return;
                }

                invoiceNumbers = invoiceNumber
                        .split(/[\s,]+/)
                        .map((v) => Number(v.trim()))
                        .filter((v) => !Number.isNaN(v));

                try {
                        const result = await createPackage({
                                articleId: selectedArticle.id,
                                customerId: selectedCustomer.id,
                                clientId: selectedClientId || null,
                                price: priceValue,
                                invoiceNumber,
                                invoiceNumbers,
                                firstPaymentDate,
                                autogiro,
                                installments: Number(installments),
                                installmentBreakdown
                        });

                        onSave?.();
                } catch (err) {
			console.error('Failed to create package', err);
			errors.submit = 'Kunde inte skapa paket. Kontrollera värdena och försök igen.';
		}
	}
</script>

<div class="mx-auto w-full max-w-full space-y-6 px-2 sm:px-4 md:max-w-[1000px]">
	<!-- 📓 Produkt -->
	<Dropdown
		id="article"
		label="Produkt"
		placeholder="Välj paket"
		options={articles.map((a) => ({
			label: `${a.name} (${a.sessions} pass – ${a.price} kr)`,
			value: a.id
		}))}
		bind:selectedValue={selectedArticleId}
		name="articleId"
		{errors}
	/>

	<!-- 👥 Kund + Klient -->
	<div class="flex flex-col gap-4 md:flex-row md:items-end md:gap-4">
		<div class="flex-1">
			<Dropdown
				id="customer"
				label="Kund"
				placeholder="Välj kund"
				options={customers.map((c) => ({ label: c.name, value: c.id }))}
				bind:selectedValue={selectedCustomerId}
				disabled={customerLocked}
				on:change={async (e) => {
					await loadClientsForCustomer(e.detail.value);
				}}
				name="customerId"
				{errors}
			/>
		</div>
		<div class="mt-[6px] shrink-0 md:mt-0">
			{#if customerId}
				{#if customerLocked}
					<Button icon="Lock" variant="secondary" on:click={() => (customerLocked = false)} />
				{:else}
					<Button icon="Unlocked" variant="secondary" on:click={() => (customerLocked = true)} />
				{/if}
			{/if}
		</div>
		<div class="flex-1">
			{#if clients.length}
				<Dropdown
					id="client"
					label="Klient"
					placeholder="Välj klient"
					options={clients.map((c) => ({ label: `${c.firstname} ${c.lastname}`, value: c.id }))}
					bind:selectedValue={selectedClientId}
					name="clientId"
					{errors}
				/>
			{/if}
		</div>
	</div>

	<!-- 💰 Pris -->
	<div class="flex flex-col gap-1">
		<div class="flex flex-col gap-2 sm:flex-row">
			<Input
				class="flex-1"
				label="Pris, ex. moms"
				bind:value={price}
				disabled={priceLocked}
				name="price"
				{errors}
			/>
			<div class="mt-[6px] sm:mt-[22px]">
				{#if priceLocked}
					<Button icon="Lock" variant="secondary" on:click={() => (priceLocked = false)} />
				{:else}
					<Button icon="Unlocked" variant="secondary" on:click={() => (priceLocked = true)} />
				{/if}
			</div>
		</div>
		{#if selectedArticle}
			<p class="text-sm text-gray-500">
				Om annat än fullpris<br />
				Pris per pass
				<strong>{(parseFloat(price) / selectedArticle.sessions).toFixed(2)} kr</strong>
			</p>
		{/if}
	</div>

	<!-- 📄 Fakturanummer -->
	<Input label="Fakturanummer" bind:value={invoiceNumber} name="invoiceNumber" {errors} />

	<!-- 🗓 Fakturadatum + Faktureringstillfällen -->
	<div class="flex flex-col gap-4 md:flex-row">
		<div class="flex-1">
			<Input
				label="Första fakturadatum"
				bind:value={firstPaymentDate}
				type="date"
				name="firstPaymentDate"
				{errors}
			/>
		</div>
		<div class="flex-1">
			<Input
				label="Antal faktureringstillfällen"
				bind:value={installments}
				type="number"
				name="installments"
				{errors}
			/>
		</div>
	</div>

	<!-- 📈 Breakdown -->
        {#if installmentBreakdown.length}
                <div class="space-y-2">
                        <div class="flex items-center justify-between">
                                <label class="text-sm font-medium">Faktureringstillfällen</label>
                                <Button
					icon={breakdownLocked ? 'Lock' : 'Unlocked'}
					variant="secondary"
					on:click={() => (breakdownLocked = !breakdownLocked)}
				/>
			</div>
			{#each installmentBreakdown as i, index}
				<div class="flex flex-col gap-2 sm:flex-row">
					<Input
						class="flex-1"
						bind:value={i.date}
						disabled={breakdownLocked}
						name={`installment-date-${index}`}
						{errors}
					/>
					<Input
						class="flex-1"
						bind:value={i.sum}
						disabled={breakdownLocked}
						name={`installment-sum-${index}`}
						{errors}
                                        />
                                </div>
                        {/each}
                        {#if errors.installmentBreakdown}
                                <p class="text-sm text-red-600">{errors.installmentBreakdown}</p>
                        {/if}
                </div>
        {/if}

	<!-- 📊 Summering -->
	<div class="flex flex-col gap-2">
                <p class="text-sm">
                        <strong>Fördelad summa:</strong>
                        {installmentBreakdown.reduce((sum, i) => sum + Number(i.sum), 0).toFixed(2)} kr av
                        {parseFloat(price || '0').toFixed(2)} kr
                </p>
                <p class="text-sm text-gray-600">
                        <strong>Återstår:</strong>
                        {(parseFloat(price || '0') - installmentBreakdown.reduce((sum, i) => sum + Number(i.sum), 0)).toFixed(
                                2
                        )} kr
                </p>
		<Button
			iconLeft="Calculator"
			text="Kontrollräkna faktureringstillfällen"
			variant="secondary"
			on:click={generateInstallmentDates}
		/>
	</div>

	<!-- ✔️ Autogiro -->
	<Checkbox bind:checked={autogiro} label="Autogiro" />

	{#if errors.submit}
		<p class="text-center text-sm text-red-600">{errors.submit}</p>
	{/if}

	<!-- 📅 Spara -->
	<div class="flex justify-end pt-4">
		<Button text="Spara" iconRight="Save" on:click={save} />
	</div>
</div>
