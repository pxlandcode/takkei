<script lang="ts">
	import Checkbox from '../components/checkbox/Checkbox.svelte';
	import Dropdown from '../components/dropdown/Dropdown.svelte';
	import InfoButton from '../components/infoButton/InfoButton.svelte';
	import Input from '../components/Input/Input.svelte';
	import { onMount, tick } from 'svelte';
	import OptionButton from '../components/optionButton/OptionButton.svelte';
	import Button from '../components/button/Button.svelte';
	import PopupWrapper from '../components/ui/popupWrapper/PopupWrapper.svelte';
	import { agreePrivayContent, agreeTermsContent } from '../content/terms';
	import { loadingStore } from '../stores/loading';
	import { createEvent } from '$lib/services/eventService';

	export let data;

	let firstname = '';
	let lastname = '';
	let email = '';
	let personnummer = '';
	let phone = '';
	let streetAddress = '';
	let zip = '';
	let city = '';

	let agreeToTerms = false;
	let agreeToPrivacy = false;

	let selectedTrainingPackage = '';
	let autogiro = false;
	let existingPackage = false;

	let isOtherPaymentAddress = false;
	let payerName = '';
	let payerEmail = '';
	let payerPhone = '';
	let payerOrganizationNumber = '';
	let payerInvoiceAddress = '';
	let payerInvoiceZip = '';
	let payerInvoiceCity = '';

	let trainingPackages = [];
	let trainingPackageOptions = [];
	let paymentInstallmentOptions = [{ value: 1, label: '1 delbetalning' }];
	let autogiroOptions = [
		{ value: false, label: 'E-postfaktura' },
		{ value: true, label: 'Autogiro' }
	];
	let selectedInstallment = paymentInstallmentOptions[0];
	let selectedAutogiro = autogiroOptions[0];
	let existingPackageOwner = '';

	let errors = {};

	let submissionComplete = false;

	// Fetch training packages
	onMount(async () => {
		try {
			const res = await fetch('/api/training-packages');
			const fetchedData = await res.json();

			trainingPackages = fetchedData.packages.map((pkg) => {
				const sessionCount = extractSessionCount(pkg.name);
				return {
					id: pkg.id,
					name: pkg.name.trim(),
					price: pkg.price_with_vat,
					sessionCount
				};
			});

			trainingPackageOptions = trainingPackages.map(
				(pkg) => `${pkg.name} - ${formatPrice(pkg.price_with_vat)} kr`
			);
		} catch (error) {
			console.error('Error fetching training packages:', error);
		}
	});

	function resetFormFields() {
		firstname = '';
		lastname = '';
		email = '';
		personnummer = '';
		phone = '';
		streetAddress = '';
		zip = '';
		city = '';
		agreeToTerms = false;
		agreeToPrivacy = false;

		selectedTrainingPackage = '';
		autogiro = false;
		isOtherPaymentAddress = false;
		payerName = '';
		payerEmail = '';
		payerPhone = '';
		payerOrganizationNumber = '';
		payerInvoiceAddress = '';
		payerInvoiceZip = '';
		payerInvoiceCity = '';

		paymentInstallmentOptions = [{ value: 1, label: '1 delbetalning' }];

		selectedInstallment = paymentInstallmentOptions[0];
		selectedAutogiro = autogiroOptions[0];
		errors = {};

		submissionComplete = false;
		existingPackage = false;
		existingPackageOwner = '';
	}

	async function handleSubmit() {
		loadingStore.loading(true, 'Skickar din information till våra tränare...');
		if (!validateForm()) {
			loadingStore.loading(false);

			const firstErrorKey = Object.keys(errors)[0];
			if (firstErrorKey) {
				const errorElement = document.getElementById(firstErrorKey);
				console.log('errorElement', errorElement);
				if (errorElement) {
					errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
				}
			}
			return;
		}

		const payload = {
			firstname,
			lastname,
			email,
			personnummer,
			phone,
			streetAddress,
			zip,
			city,
			agreeToTerms,
			agreeToPrivacy,
			existingPackage,
			selectedTrainingPackage: existingPackage ? null : selectedTrainingPackage,
			autogiro: existingPackage ? null : autogiro,
			paymentChoice: isOtherPaymentAddress ? 'company' : 'self',
			payerName: isOtherPaymentAddress
				? payerName
				: existingPackage
					? null
					: `${firstname} ${lastname}`,
			payerEmail: isOtherPaymentAddress ? payerEmail : existingPackage ? null : email,
			payerPhone: isOtherPaymentAddress ? payerPhone : existingPackage ? null : phone,
			payerOrganizationNumber: isOtherPaymentAddress ? payerOrganizationNumber : null,
			payerInvoiceAddress: isOtherPaymentAddress
				? payerInvoiceAddress
				: existingPackage
					? null
					: streetAddress,
			payerInvoiceZip: isOtherPaymentAddress ? payerInvoiceZip : existingPackage ? null : zip,
			payerInvoiceCity: isOtherPaymentAddress ? payerInvoiceCity : existingPackage ? null : city,
			installmentsCount: existingPackage ? null : selectedInstallment.value
		};

		try {
			const res = await fetch('/api/signup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			const responseData = await res.json();

			let description = `En ny klient har skapats via formuläret.\nKlient: ${responseData.clientName}\nKlientens email: ${responseData.email}\nKlient ID: ${responseData.clientId}\n${existingPackage ? `Klienten ska träna på befintligt paket som ägs av ${existingPackageOwner}` : `Kund ID: ${responseData.customerId}\nPaket ID: ${responseData.packageId}`}`;

			const responseEvent = await createEvent({
				name: `Ny klient med ID ${responseData.clientId} registrerad via formuläret`,
				user_ids: [2, 19],
				description,
				start_time: new Date().toISOString(),
				end_time: new Date().toISOString(),
				active: true,
				done: false
			});

			submissionComplete = true;
			loadingStore.loading(false);
		} catch (error) {
			console.error('Error submitting form:', error);
			loadingStore.loading(false);
		}
	}

	function formatPrice(price: number) {
		return new Intl.NumberFormat('sv-SE').format(Math.round(price));
	}

	function handlePaymentChoiceChange(value: boolean) {
		isOtherPaymentAddress = value;
	}
	function handleTermsAcceptanceChange(value: boolean) {
		agreeToTerms = value;
	}

	function handleExistingPackageChange(value: boolean) {
		existingPackage = value;
	}

	function handlePersonalDataAcceptanceChange(value: boolean) {
		agreeToPrivacy = value;
	}

	async function handleTrainingPackageChange(event) {
		selectedTrainingPackage = event.detail.value; // ✅ Update selected training package first
		await tick(); // ✅ Wait for UI update before updating installments
		updateInstallmentOptions();
	}

	function extractSessionCount(name) {
		const match = name.match(/(\d+)/);
		return match ? parseInt(match[1]) : 1; // Default to 1 if no number is found
	}

	function getPricePerSession(pkg) {
		const sessionCountMatch = pkg.name.match(/(\d+)/);
		const sessionCount = sessionCountMatch ? parseInt(sessionCountMatch[1]) : 1;

		const pricePerSession = pkg.price_with_vat / sessionCount;

		return pricePerSession;
	}

	function updateInstallmentOptions() {
		if (!selectedTrainingPackage) return;

		// Extract only the package name (remove price formatting)
		const extractedName = selectedTrainingPackage.split(' - ')[0];

		// Find the corresponding package object

		const selectedPackage = trainingPackages.find(
			(pkg) => pkg.name.trim() === extractedName.trim()
		);

		if (!selectedPackage) return;

		const sessionCount = selectedPackage.sessionCount;

		let options = [{ value: 1, label: '1 st' }];

		if (sessionCount >= 12) options.push({ value: 3, label: '3 st' });
		if (sessionCount >= 24) options.push({ value: 6, label: '6 st' });
		if (sessionCount >= 48) options.push({ value: 12, label: '12 st' });

		paymentInstallmentOptions = options;
		selectedInstallment = options[0];
	}

	function validateForm() {
		let isValid = true;

		// Reset errors
		errors = {};

		if (!firstname) {
			errors.firstname = 'Förnamn är obligatoriskt';
			isValid = false;
		}
		if (!lastname) {
			errors.lastname = 'Efternamn är obligatoriskt';
			isValid = false;
		}
		if (!email || !/\S+@\S+\.\S+/.test(email)) {
			errors.email = 'Ogiltig e-postadress';
			isValid = false;
		}
		if (!personnummer || !/^\d{6}-\d{4}$/.test(personnummer)) {
			errors.personnummer = 'Ogiltigt personnummer (format: ÅÅMMDD-XXXX)';
			isValid = false;
		}
		if (!phone) {
			errors.phone = 'Ogiltigt telefonnummer';
			isValid = false;
		}
		if (!streetAddress) {
			errors.streetAddress = 'Gatuadress är obligatorisk';
			isValid = false;
		}
		if (!zip || !/^\d{3} ?\d{2}$/.test(zip)) {
			errors.zip = 'Ogiltigt postnummer';
			isValid = false;
		}
		if (!city) {
			errors.city = 'Ort är obligatorisk';
			isValid = false;
		}
		if (!agreeToTerms) {
			errors['accept-terms'] = 'Du måste godkänna villkoren';
			isValid = false;
		}
		if (!agreeToPrivacy) {
			errors['accept-handling-of-personal-data'] = 'Du måste godkänna hantering av personuppgifter';
			isValid = false;
		}

		// Skip checking these if `existingPackage` is true
		if (!existingPackage) {
			if (!selectedTrainingPackage) {
				errors['training-package'] = 'Välj ett träningspaket';
				isValid = false;
			}
			if (!selectedInstallment) {
				errors['payment-installment'] = 'Välj en delbetalning';
				isValid = false;
			}
		}

		if (existingPackage) {
			if (!existingPackageOwner) {
				errors['existing-package-owner'] = 'Fyll i ägaren av det befintliga paketet';
				isValid = false;
			}
		}

		// Skip payer details validation if `existingPackage` is true
		if (isOtherPaymentAddress && !existingPackage) {
			if (!payerName) (errors.payerName = 'Företagsnamn/Namn är obligatoriskt'), (isValid = false);
			if (!payerEmail || !/\S+@\S+\.\S+/.test(payerEmail))
				(errors.payerEmail = 'Ogiltig e-postadress'), (isValid = false);
			if (!payerPhone) (errors.payerPhone = 'Ogiltigt telefonnummer'), (isValid = false);
			if (!payerOrganizationNumber || !/^\d{6}-\d{4}$/.test(payerOrganizationNumber))
				(errors.payerOrganizationNumber = 'Organisationsnummer/Personnummer är obligatoriskt'),
					(isValid = false);
			if (!payerInvoiceAddress)
				(errors.payerInvoiceAddress = 'Fakturaadress är obligatorisk'), (isValid = false);
			if (!payerInvoiceZip || !/^\d{3} ?\d{2}$/.test(payerInvoiceZip))
				(errors.payerInvoiceZip = 'Ogiltigt postnummer'), (isValid = false);
			if (!payerInvoiceCity) (errors.payerInvoiceCity = 'Ort är obligatorisk'), (isValid = false);
		}

		return isValid;
	}
	let isPopupOpen = false;
	let popupHeader = '';
	let popupContent = '';
	let popupIcon = 'CircleInfo';

	function openPopup(header: string, content: string) {
		popupHeader = header;
		popupContent = content;
		isPopupOpen = true;
	}

	function closePopup() {
		isPopupOpen = false;
	}
</script>

{#if submissionComplete}
	<div class="flex h-full flex-col items-center justify-center">
		<h1 class="text-2xl font-semibold">Tack för din information!</h1>
		<p class="mb-4 text-sm">Vi ser fram emot att träna med dig.</p>
		{#if autogiro}
			<p class="mb-4">
				<a
					href="https://www.mvh.bgonline.se/mandate/9e127c16-516e-4e10-8df9-6db1bc6cad01"
					class="text-orange-500 hover:text-orange-600"
				>
					Klicka här för att fylla i dina uppgifter för autogiro.
				</a>
			</p>
		{/if}
		<div class="w-full max-w-md rounded-lg p-4 shadow-md">
			<h2 class="mb-2 text-lg font-semibold">Din kvittens</h2>
			<p><strong>Namn:</strong> {firstname} {lastname}</p>
			<p><strong>E-post:</strong> {email}</p>
			<p><strong>Telefon:</strong> {phone}</p>
			{#if !existingPackage}
				<p><strong>Träningspaket:</strong> {selectedTrainingPackage || 'Ej valt'}</p>
				<p><strong>Delbetalningar:</strong> {selectedInstallment.label}</p>
			{:else}
				<p><strong>Ska träna på befintligt paket som ägs av:</strong> {existingPackageOwner}</p>
			{/if}

			{#if isOtherPaymentAddress}
				<h3 class="text-md mt-3 font-semibold">Betalningsinformation</h3>
				<p><strong>Betalare:</strong> {payerName}</p>
				<p><strong>E-post (betalare):</strong> {payerEmail}</p>
				<p><strong>Telefon (betalare):</strong> {payerPhone}</p>
				<p>
					<strong>Faktureringsadress:</strong>
					{payerInvoiceAddress}, {payerInvoiceZip}
					{payerInvoiceCity}
				</p>
			{/if}
		</div>

		<button
			class="mt-6 rounded-lg bg-orange-500 px-4 py-2 text-white shadow-md transition hover:bg-orange-600"
			on:click={resetFormFields}
		>
			Registrera en annan tränande
		</button>
	</div>
{:else}
	<form class="mx-auto max-w-md" on:submit|preventDefault={handleSubmit}>
		<div class="flex flex-col gap-2 pb-2">
			<p class="text-sm">Fyll i dina uppgifter och välj paket</p>
			<h2 class="pt-4 text-xl font-semibold">Personuppgifter</h2>
		</div>

		<div class="flex flex-row gap-2">
			<Input
				label="Förnamn"
				name="firstname"
				bind:value={firstname}
				placeholder="Förnamn"
				{errors}
			/>
			<Input
				label="Efternamn"
				name="lastname"
				bind:value={lastname}
				placeholder="Efternamn"
				{errors}
			/>
		</div>
		<Input
			label="E-post"
			name="email"
			type="email"
			bind:value={email}
			placeholder="info@takkei.se"
			{errors}
		/>

		<div class="flex flex-row gap-2">
			<Input
				label="Personnummer"
				name="personnummer"
				bind:value={personnummer}
				placeholder="xxxxxx-xxxx (10 siffror)"
				{errors}
			/>
			<Input
				label="Mobilnummer"
				name="phone"
				bind:value={phone}
				placeholder="07xxxxxxxx"
				{errors}
			/>
		</div>

		<Input
			label="Gatuadress"
			name="streetAddress"
			bind:value={streetAddress}
			placeholder="Garvargatan 7"
			{errors}
		/>
		<div class="flex space-x-2">
			<Input label="Postnummer" name="zip" bind:value={zip} placeholder="112 21" {errors} />
			<Input label="Ort" name="city" bind:value={city} placeholder="Stockholm" {errors} />
		</div>

		<h2 class="pb-2 pt-4 text-xl font-semibold">Träningspaket &amp; Betalningsalternativ</h2>
		<div class="flex flex-row gap-4 py-4">
			<Checkbox
				id="existing-package"
				label="Jag ska träna på ett befintligt paket"
				name="payment-choice"
				checked={existingPackage}
				on:change={(e) => handleExistingPackageChange(e.detail.checked)}
			/>
			<InfoButton
				info="Välj detta alternativ om det redan finns ett befintligt träningspaket du ska träna på. Om exempelvis en familjemedlem eller ditt företag redan betalar för ett paket."
			/>
		</div>

		{#if existingPackage}
			<div class="flex flex-row gap-4 py-4">
				<Input
					label="Det befintliga paketets ägare"
					name="existing-package-owner"
					bind:value={existingPackageOwner}
					placeholder="Namn/företag"
					{errors}
				/>
				<div class="mt-7">
					<InfoButton
						info="Fyll i namnet på den person eller det företag som betalar för det befintliga paketet."
					/>
				</div>
			</div>
		{:else}
			<div class="flex flex-col gap-2">
				<h3>Prislista 2025 (ink. moms)</h3>
				<ul>
					{#each data.packages as pkg}
						<li>
							{pkg.name} - {formatPrice(pkg.price_with_vat)}kr
							<span class="text-gray-500">
								= {formatPrice(getPricePerSession(pkg))}kr/träningstillfälle</span
							>
						</li>
					{/each}
				</ul>
			</div>
			<div class="flex flex-row items-center gap-2 pt-4">
				<Dropdown
					id="training-package"
					label="Träningspaket"
					bind:selectedValue={selectedTrainingPackage}
					options={data.packages.map((pkg) => `${pkg.name} - ${formatPrice(pkg.price_with_vat)}kr`)}
					on:change={handleTrainingPackageChange}
					{errors}
				/>
				<div class="mt-7">
					<InfoButton
						info="Ett träningspaket fungerar som ett klippkort, skulle du betala allt på en gång så finns träningarna tillgodo tills de nyttjas. Alternativt delbetala månadsvis utifrån ett förutbestämt antal delbetalningar."
					/>
				</div>
			</div>

			<h3 class="pt-4">Betalningsalternativ</h3>

			<div class="flex flex-col gap-4">
				{#if paymentInstallmentOptions.length > 1}
					<p class="pt-4">Välj antal delbetalningar</p>
					<OptionButton
						options={paymentInstallmentOptions}
						bind:selectedOption={selectedInstallment}
						on:select={(event) =>
							(selectedInstallment = paymentInstallmentOptions.find(
								(opt) => opt.value === event.detail
							))}
					/>
				{/if}
				<div class="flex flex-row justify-between">
					<p class="pt-4">Välj betalningsalternativ</p>
					<InfoButton
						info="Vid val av autogiro ber vi dig klicka på länken efter du bekräftat din beställning och fylla i dina uppgifter. Om du inte har tid idag kommer vi skicka dig en påminnelse."
					/>
				</div>

				<OptionButton
					options={autogiroOptions}
					bind:selectedOption={selectedAutogiro}
					on:select={(event) => {
						autogiro = event.detail;
					}}
				/>
				<div class="flex flex-row gap-4 py-4">
					<Checkbox
						id="other-billing"
						label="Annan faktureringsadress"
						name="payment-choice"
						checked={isOtherPaymentAddress}
						on:change={(e) => handlePaymentChoiceChange(e.detail.checked)}
					/>
					<InfoButton
						info="Välj om fakturan ska betalas av ett företag eller någon annan än dig."
					/>
				</div>
			</div>

			{#if isOtherPaymentAddress}
				<h2 class="text-xl font-semibold">Betalare</h2>
				<Input
					label="Företagsnamn/Namn"
					name="payerName"
					bind:value={payerName}
					placeholder="Takkei Trainingsystems AB"
					{errors}
				/>
				<Input
					label="E-post"
					name="payerEmail"
					bind:value={payerEmail}
					placeholder="info@takkei.se"
					{errors}
				/>
				<div class="flex flex-row gap-2">
					<Input
						label="Organisationsnummer"
						name="payerOrganizationNumber"
						bind:value={payerOrganizationNumber}
						placeholder="xxxxxx-xxxx"
						{errors}
					/>
					<Input
						label="Telefonnummer"
						name="payerPhone"
						bind:value={payerPhone}
						placeholder="08xxxxxx"
						{errors}
					/>
				</div>

				<Input
					label="Fakturaadress"
					name="payerInvoiceAddress"
					bind:value={payerInvoiceAddress}
					placeholder="Garvargatan 7"
					{errors}
				/>
				<div class="flex space-x-2">
					<Input
						label="Postnummer"
						name="payerInvoiceZip"
						bind:value={payerInvoiceZip}
						placeholder="112 21"
						{errors}
					/>
					<Input
						label="Ort"
						name="payerInvoiceCity"
						bind:value={payerInvoiceCity}
						placeholder="Stockholm"
						{errors}
					/>
				</div>
			{/if}
		{/if}

		<div class="flex flex-col gap-4 pb-4">
			<h3 class="pt-4 text-xl font-semibold">Godkännande av vilkor</h3>

			<Checkbox
				id="accept-terms"
				label="Jag godkänner villkoren"
				name="accept-terms"
				checked={agreeToTerms}
				on:change={(e) => handleTermsAcceptanceChange(e.detail.checked)}
				{errors}
			/>
			<Checkbox
				id="accept-handling-of-personal-data"
				label="Jag godkänner hanteringen av mina personuppgifter"
				name="accept-handling-of-personal-data"
				checked={agreeToPrivacy}
				on:change={(e) => handlePersonalDataAcceptanceChange(e.detail.checked)}
				{errors}
			/>

			<div class="flex flex-row gap-4">
				<Button onClick={() => openPopup('Villkor', agreeTermsContent)}>Läs villkoren</Button>
				<Button onClick={() => openPopup('Hantering av personuppgifter', agreePrivayContent)}
					>Läs hur vi hanterar dina personupptifter</Button
				>
			</div>
		</div>

		<button
			type="submit"
			class="w-full rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:bg-orange-500/50"
			disabled={$loadingStore.isLoading}>Bekräfta</button
		>
	</form>
{/if}

{#if isPopupOpen}
	<PopupWrapper width="600px" icon={popupIcon} header={popupHeader} on:close={closePopup}>
		{@html popupContent}
	</PopupWrapper>
{/if}

<style>
</style>
