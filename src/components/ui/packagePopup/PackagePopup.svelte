<script lang="ts">
	import { onMount } from 'svelte';

	import {
		createPackage,
		getArticles,
		getClientsForCustomer,
		updatePackage
	} from '$lib/services/api/packageService';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import Input from '../../bits/Input/Input.svelte';
	import Checkbox from '../../bits/checkbox/Checkbox.svelte';
	import Button from '../../bits/button/Button.svelte';

	type InitialPackageInput = {
		id?: number;
		article?: { id: number; price?: number; sessions?: number } | null;
		customer?: { id: number } | null;
		client?: { id: number } | null;
		paid_price?: number | null;
		invoice_no?: string | number | null;
		invoice_numbers?: (number | string)[] | null;
		first_payment_date?: string | null;
		autogiro?: boolean | null;
		installments?: { date: string; sum: number; invoice_no?: string }[] | null;
		installments_summary?: { count?: number | null } | null;
	};

	export let onSave;
	export let customerId: number = null;
	export let mode: 'create' | 'edit' = 'create';
	export let packageId: number | null = null;
	export let initialPackage: InitialPackageInput | null = null;

let customerLocked = customerId !== null;

let articles = [];
let customers = [];
let clients = [];

	let selectedArticleId: number | '' = '';
	let selectedCustomerId: number | '' = '';
	let selectedClientId: number | '' = '';

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
let initialDataApplied = false;

        let installmentBreakdown: { date: string; sum: number; invoice_no?: string }[] = [];

	function normalizeDateInput(value: string | Date | null | undefined): string {
		if (!value) return '';
		if (value instanceof Date) {
			if (Number.isNaN(value.getTime())) return '';
			return value.toISOString().split('T')[0];
		}
		if (typeof value === 'string') {
			const parsed = new Date(value);
			if (Number.isNaN(parsed.getTime())) return value;
			return parsed.toISOString().split('T')[0];
		}
		return '';
	}

	function ensureCustomerOption(customer: { id: number; name?: string } | null | undefined) {
		if (!customer?.id) return;
		const idNum = Number(customer.id);
		if (!customers.some((c) => Number(c.id) === idNum)) {
			customers = [...customers, { ...customer, id: idNum }];
		}
	}

	function ensureArticleOption(
		article: { id: number; name?: string; price?: number; sessions?: number } | null | undefined
	) {
		if (!article?.id) return;
		const idNum = Number(article.id);
		const fallbackPrice =
			initialPackage && Number(initialPackage.article?.id) === idNum
				? initialPackage.paid_price ?? initialPackage.article?.price ?? null
				: null;
		const normalizedArticle = {
			...article,
			id: idNum,
			price: article.price ?? fallbackPrice,
			sessions: article.sessions ?? initialPackage?.article?.sessions ?? null
		};
		if (!articles.some((a) => Number(a.id) === idNum)) {
			articles = [...articles, normalizedArticle];
		} else {
			articles = articles.map((a) =>
				Number(a.id) === idNum
					? {
							...a,
							...normalizedArticle,
							price: a.price ?? normalizedArticle.price,
							sessions: a.sessions ?? normalizedArticle.sessions
					  }
					: a
			);
		}
	}

	const today = new Date();
	firstPaymentDate = today.toISOString().split('T')[0];

	function formatArticleLabel(article: { id: number; name?: string; price?: number; sessions?: number }) {
		const idNum = Number(article.id);
		const fallbackPrice =
			initialPackage && Number(initialPackage.article?.id) === idNum
				? initialPackage.paid_price ?? initialPackage.article?.price ?? null
				: null;
		const priceValue = article.price ?? fallbackPrice;
		const sessionsValue = article.sessions ?? initialPackage?.article?.sessions ?? '—';
		const priceText = priceValue != null ? `${priceValue} kr` : '— kr';
		return `${article.name ?? 'Paket'} (${sessionsValue} pass – ${priceText})`;
	}

	onMount(async () => {
		const res = await fetch('/api/customers?short=true');
		customers = await res.json();
		articles = await getArticles();
		ensureCustomerOption(initialPackage?.customer ?? null);
		ensureArticleOption(initialPackage?.article ?? null);

		if (customerId) {
			selectedCustomerId = Number(customerId);
			selectedCustomer = customers.find((c) => Number(c.id) === Number(customerId)) ?? null;
			await loadClientsForCustomer(customerId, true);
		}
	});

	$: if (selectedArticleId) {
		const match = articles.find((a) => Number(a.id) === Number(selectedArticleId)) ?? null;
		const fallbackPrice =
			initialPackage && Number(initialPackage.article?.id) === Number(selectedArticleId)
				? initialPackage.paid_price ?? initialPackage.article?.price ?? null
				: null;
		const fallbackSessions =
			initialPackage && Number(initialPackage.article?.id) === Number(selectedArticleId)
				? initialPackage.article?.sessions ?? null
				: null;
		selectedArticle = match
			? {
					...match,
					price: match.price ?? fallbackPrice,
					sessions: match.sessions ?? fallbackSessions
			  }
			: initialPackage && Number(initialPackage.article?.id) === Number(selectedArticleId)
				? {
						...initialPackage.article,
						price: fallbackPrice,
						sessions: fallbackSessions
				  }
				: null;
	}
	$: if (selectedCustomerId) {
		selectedCustomer = customers.find((c) => Number(c.id) === Number(selectedCustomerId)) ?? null;
	}

	$: if (selectedArticle && priceLocked) price = selectedArticle.price ?? price;

	async function loadClientsForCustomer(id: number | string, preserveSelection = false) {
		const res = await getClientsForCustomer(Number(id));
		clients = res;
		if (preserveSelection) {
			if (!selectedClientId || !clients.some((c) => c.id === Number(selectedClientId))) {
				selectedClientId = '';
			}
		} else {
			selectedClientId = '';
		}
	}

	$: if (mode !== 'edit') {
		const priceValue = parseFloat(price);
		if (firstPaymentDate && Number(installments) > 0 && !isNaN(priceValue)) {
			generateInstallmentDates();
		} else if (!firstPaymentDate || !installments || isNaN(priceValue)) {
			installmentBreakdown = [];
		}
	}

	function addMonthsPreserveDay(dateStr: string, offset: number): string {
		const [y, m, d] = dateStr.split('-').map(Number);
		if (!y || !m || !d) return dateStr;

		const targetMonthIndex = m - 1 + offset;
		const nextYear = y + Math.floor(targetMonthIndex / 12);
		const nextMonth = ((targetMonthIndex % 12) + 12) % 12; // keep 0-11
		const daysInTargetMonth = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
		const safeDay = Math.min(d, daysInTargetMonth);
		return new Date(Date.UTC(nextYear, nextMonth, safeDay)).toISOString().split('T')[0];
	}

	function generateInstallmentDates() {
		const installmentsCount = Number(installments);
		if (!firstPaymentDate || installmentsCount <= 0) {
			installmentBreakdown = [];
			return;
		}
		const total = parseFloat(price || '0');
		const evenSum = installmentsCount > 0 ? total / installmentsCount : 0;
		let remainder = total;
		installmentBreakdown = Array.from({ length: installmentsCount }, (_, i) => {
			const formattedDate = addMonthsPreserveDay(firstPaymentDate, i);

			let sum = i === installmentsCount - 1 ? remainder : parseFloat(evenSum.toFixed(2));
			remainder = parseFloat((remainder - sum).toFixed(2));

			return { date: formattedDate, sum: Number(sum.toFixed(2)) };
		});
	}

	async function applyInitialPackageData(pkg: InitialPackageInput) {
		if (!pkg || initialDataApplied) return;
		ensureCustomerOption(pkg.customer ?? null);
		ensureArticleOption(pkg.article ?? null);
		if (pkg.customer?.id) {
			selectedCustomerId = Number(pkg.customer.id);
			await loadClientsForCustomer(pkg.customer.id, true);
		}
		selectedClientId = pkg.client?.id ? Number(pkg.client.id) : '';
		selectedArticleId = pkg.article?.id ? Number(pkg.article.id) : '';
		priceLocked = false;
		price = pkg.paid_price != null ? String(pkg.paid_price) : price;
		const numericInvoices = Array.isArray(pkg.invoice_numbers)
			? pkg.invoice_numbers
					.map((value: any) => Number(value))
					.filter((n: number) => Number.isInteger(n))
			: [];
		invoiceNumbers = numericInvoices;
		if (pkg.invoice_no !== null && pkg.invoice_no !== undefined && `${pkg.invoice_no}`.length > 0) {
			invoiceNumber = String(pkg.invoice_no);
		} else if (numericInvoices.length) {
			invoiceNumber = numericInvoices.join(', ');
		} else {
			invoiceNumber = '';
		}
		const initialDate =
			normalizeDateInput(pkg.first_payment_date) ||
			normalizeDateInput(pkg.installments?.[0]?.date) ||
			firstPaymentDate;
		firstPaymentDate = initialDate;
		autogiro = !!pkg.autogiro;
		const breakdown = Array.isArray(pkg.installments)
			? pkg.installments.map((i) => ({
					date: i.date,
					sum: Number(i.sum) || 0,
					invoice_no: i.invoice_no ?? ''
			  }))
			: [];
		if (breakdown.length) {
			installmentBreakdown = breakdown;
			installments = breakdown.length;
		} else if (pkg.installments_summary?.count) {
			installments = Number(pkg.installments_summary.count) || installments;
			installmentBreakdown = [];
		}
		initialDataApplied = true;
	}

	$: if (mode === 'edit' && initialPackage && !initialDataApplied) {
		void applyInitialPackageData(initialPackage);
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

		if (installmentBreakdown.length === 0 || Number(installments) !== installmentBreakdown.length) {
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

	const payload = {
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
	};

	try {
		const result =
			mode === 'edit' && packageId
				? await updatePackage(packageId, payload)
				: await createPackage(payload);

		onSave?.(result);
	} catch (err) {
		console.error('Failed to save package', err);
		errors.submit = 'Kunde inte spara paketet. Kontrollera värdena och försök igen.';
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
			label: formatArticleLabel(a),
			value: Number(a.id)
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
				options={customers.map((c) => ({ label: c.name, value: Number(c.id) }))}
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
					options={clients.map((c) => ({
						label: `${c.firstname} ${c.lastname}`,
						value: Number(c.id)
					}))}
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
		<Button text={mode === 'edit' ? 'Uppdatera paket' : 'Spara'} iconRight="Save" on:click={save} />
	</div>
</div>
