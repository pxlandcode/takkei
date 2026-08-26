<script lang="ts">
	import { tick } from 'svelte';
	import type { PageData } from './$types';
	import Checkbox from '../../components/bits/checkbox/Checkbox.svelte';
	import Dropdown from '../../components/bits/dropdown/Dropdown.svelte';
	import InfoButton from '../../components/bits/infoButton/InfoButton.svelte';
	import Input from '../../components/bits/Input/Input.svelte';
	import OptionButton from '../../components/bits/optionButton/OptionButton.svelte';
	import Button from '../../components/bits/button/Button.svelte';
	import PopupWrapper from '../../components/ui/popupWrapper/PopupWrapper.svelte';
	import { agreePrivacyContent, agreeTermsContent } from '$lib/content/signupTerms';
	import { loadingStore } from '$lib/stores/loading';

	export let data: PageData;

	type SignupPackage = PageData['packages'][number];
	type SelectOption<T = string | number | boolean> = { value: T; label: string };

	let firstname = '';
	let lastname = '';
	let email = '';
	let person_number = '';
	let phone = '';
	let streetAddress = '';
	let zip = '';
	let city = '';

	let agreeToTerms = false;
	let agreeToPrivacy = false;

	let selectedTrainingPackage = '';
	let autogiro = false;
	let existingPackage = false;
	let existingPackageOwner = '';

	let isOtherPaymentAddress = false;
	let payerName = '';
	let payerEmail = '';
	let payerPhone = '';
	let payerOrganizationNumber = '';
	let payerInvoiceAddress = '';
	let payerInvoiceZip = '';
	let payerInvoiceCity = '';

	let paymentInstallmentOptions: SelectOption<number>[] = [{ value: 1, label: '1 delbetalning' }];
	const autogiroOptions: SelectOption<boolean>[] = [
		{ value: false, label: 'E-postfaktura' },
		{ value: true, label: 'Autogiro' }
	];
	let selectedInstallment = paymentInstallmentOptions[0];
	let selectedAutogiro = autogiroOptions[0];

	let errors: Record<string, string> = {};
	let submissionComplete = false;
	let isPopupOpen = false;
	let popupHeader = '';
	let popupContent = '';

	$: packageOptions = data.packages.map(
		(pkg) => `${pkg.name} - ${formatPrice(pkg.price_with_vat)}kr`
	);

	function resetFormFields() {
		firstname = '';
		lastname = '';
		email = '';
		person_number = '';
		phone = '';
		streetAddress = '';
		zip = '';
		city = '';
		agreeToTerms = false;
		agreeToPrivacy = false;

		selectedTrainingPackage = '';
		autogiro = false;
		existingPackage = false;
		existingPackageOwner = '';
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
	}

	async function scrollToFirstError() {
		await tick();
		const firstErrorKey = Object.keys(errors)[0];
		if (!firstErrorKey) return;

		const errorElement = document.getElementById(firstErrorKey);
		errorElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	async function handleSubmit() {
		errors = {};
		loadingStore.loading(true, 'Skickar din information till våra tränare...');

		if (!validateForm()) {
			loadingStore.loading(false);
			await scrollToFirstError();
			return;
		}

		const payload = {
			firstname,
			lastname,
			email,
			person_number,
			personnummer: person_number,
			phone,
			streetAddress,
			zip,
			city,
			agreeToTerms,
			agreeToPrivacy,
			existingPackage,
			existingPackageOwner,
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

			if (!res.ok) {
				errors = responseData.errors ?? {
					general: responseData.error ?? 'Något gick fel. Försök igen.'
				};
				await scrollToFirstError();
				return;
			}

			submissionComplete = true;
		} catch (error) {
			console.error('Error submitting signup form:', error);
			errors.general = 'Något gick fel. Försök igen.';
			await scrollToFirstError();
		} finally {
			loadingStore.loading(false);
		}
	}

	function formatPrice(price: number | string | null | undefined) {
		const numericPrice = Number(price ?? 0);
		return new Intl.NumberFormat('sv-SE').format(Math.round(numericPrice));
	}

	function handlePaymentChoiceChange(value: boolean) {
		isOtherPaymentAddress = value;
	}

	function handleExistingPackageChange(value: boolean) {
		existingPackage = value;
	}

	function handleTrainingPackageChange(event: CustomEvent<{ value: string }>) {
		selectedTrainingPackage = event.detail.value;
		updateInstallmentOptions();
	}

	function extractSessionCount(name: string) {
		const match = name.match(/(\d+)/);
		return match ? parseInt(match[1], 10) : 1;
	}

	function getPricePerSession(pkg: SignupPackage) {
		const sessionCount = extractSessionCount(pkg.name);
		return Number(pkg.price_with_vat ?? 0) / sessionCount;
	}

	function updateInstallmentOptions() {
		if (!selectedTrainingPackage) return;

		const extractedName = selectedTrainingPackage.split(' - ')[0];
		const selectedPackage = data.packages.find((pkg) => pkg.name.trim() === extractedName.trim());

		if (!selectedPackage) return;

		const sessionCount = extractSessionCount(selectedPackage.name);
		const options: SelectOption<number>[] = [{ value: 1, label: '1 st' }];

		if (sessionCount >= 12) options.push({ value: 3, label: '3 st' });
		if (sessionCount >= 24) options.push({ value: 6, label: '6 st' });
		if (sessionCount >= 48) options.push({ value: 12, label: '12 st' });

		paymentInstallmentOptions = options;
		selectedInstallment = options[0];
	}

	function validateForm() {
		let isValid = true;
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
		if (!person_number || !/^\d{6}-\d{4}$/.test(person_number)) {
			errors.person_number = 'Ogiltigt personnummer (format: ÅÅMMDD-XXXX)';
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

		if (existingPackage && !existingPackageOwner) {
			errors.existingPackageOwner = 'Fyll i ägaren av det befintliga paketet';
			isValid = false;
		}

		if (isOtherPaymentAddress && !existingPackage) {
			if (!payerName) {
				errors.payerName = 'Företagsnamn/Namn är obligatoriskt';
				isValid = false;
			}
			if (!payerEmail || !/\S+@\S+\.\S+/.test(payerEmail)) {
				errors.payerEmail = 'Ogiltig e-postadress';
				isValid = false;
			}
			if (!payerPhone) {
				errors.payerPhone = 'Ogiltigt telefonnummer';
				isValid = false;
			}
			if (!payerOrganizationNumber || !/^\d{6}-\d{4}$/.test(payerOrganizationNumber)) {
				errors.payerOrganizationNumber = 'Organisationsnummer/Personnummer är obligatoriskt';
				isValid = false;
			}
			if (!payerInvoiceAddress) {
				errors.payerInvoiceAddress = 'Fakturaadress är obligatorisk';
				isValid = false;
			}
			if (!payerInvoiceZip || !/^\d{3} ?\d{2}$/.test(payerInvoiceZip)) {
				errors.payerInvoiceZip = 'Ogiltigt postnummer';
				isValid = false;
			}
			if (!payerInvoiceCity) {
				errors.payerInvoiceCity = 'Ort är obligatorisk';
				isValid = false;
			}
		}

		return isValid;
	}

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
	<div class="flex h-full min-h-[calc(100dvh-3rem)] flex-col items-center justify-center">
		<h1 class="text-center text-2xl font-semibold">Tack för din information!</h1>
		<p class="mb-4 text-center text-sm">Vi ser fram emot att träna med dig.</p>
		{#if autogiro}
			<p class="mb-4 text-center">
				<a
					href="https://www.mvh.bgonline.se/mandate/9e127c16-516e-4e10-8df9-6db1bc6cad01"
					class="text-orange-500 hover:text-orange-600"
				>
					Klicka här för att fylla i dina uppgifter för autogiro.
				</a>
			</p>
		{/if}
		<div class="w-full max-w-md rounded-sm p-4 shadow-md">
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

		<div class="mt-6 w-full max-w-md">
			<Button
				text="Registrera en annan tränande"
				variant="primary"
				full
				on:click={resetFormFields}
			/>
		</div>
	</div>
{:else}
	<form class="mx-auto max-w-md" on:submit|preventDefault={handleSubmit}>
		<div class="flex flex-col gap-2 pb-2">
			<p class="text-sm">Fyll i dina uppgifter och välj paket</p>
			<h2 class="pt-4 text-xl font-semibold">Personuppgifter</h2>
		</div>

		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
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

		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
			<Input
				label="Personnummer"
				name="person_number"
				bind:value={person_number}
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
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
			<Input label="Postnummer" name="zip" bind:value={zip} placeholder="112 21" {errors} />
			<Input label="Ort" name="city" bind:value={city} placeholder="Stockholm" {errors} />
		</div>

		<h2 class="pt-4 pb-2 text-xl font-semibold">Träningspaket &amp; Betalningsalternativ</h2>
		<div class="flex flex-row gap-4 py-4">
			<Checkbox
				id="existing-package"
				label="Jag ska träna på ett befintligt paket"
				name="existing-package"
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
					name="existingPackageOwner"
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
							<span class="text-gray-300">
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
					options={packageOptions}
					variant="black"
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
						id="payment-installment"
						options={paymentInstallmentOptions}
						bind:selectedOption={selectedInstallment}
						variant="black"
						full
						{errors}
						on:select={(event) => {
							const next = paymentInstallmentOptions.find((opt) => opt.value === event.detail);
							if (next) selectedInstallment = next;
						}}
					/>
				{/if}
				<div class="flex flex-row justify-between gap-4">
					<p class="pt-4">Välj betalningsalternativ</p>
					<InfoButton
						info="Vid val av autogiro ber vi dig klicka på länken efter du bekräftat din beställning och fylla i dina uppgifter. Om du inte har tid idag kommer vi skicka dig en påminnelse."
					/>
				</div>

				<OptionButton
					options={autogiroOptions}
					bind:selectedOption={selectedAutogiro}
					variant="black"
					full
					on:select={(event) => {
						autogiro = event.detail;
					}}
				/>
				<div class="flex flex-row gap-4 py-4">
					<Checkbox
						id="other-billing"
						label="Annan faktureringsadress"
						name="other-billing"
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
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
				on:change={(e) => (agreeToTerms = e.detail.checked)}
				{errors}
			/>
			<Checkbox
				id="accept-handling-of-personal-data"
				label="Jag godkänner hanteringen av mina personuppgifter"
				name="accept-handling-of-personal-data"
				checked={agreeToPrivacy}
				on:change={(e) => (agreeToPrivacy = e.detail.checked)}
				{errors}
			/>

			<div class="flex flex-col gap-4 sm:flex-row">
				<Button
					text="Läs villkoren"
					variant="secondary"
					class="h-auto min-h-[45px] py-2 whitespace-normal"
					on:click={() => openPopup('Villkor', agreeTermsContent)}
				/>
				<Button
					text="Läs hur vi hanterar dina personuppgifter"
					variant="secondary"
					class="h-auto min-h-[45px] py-2 text-sm whitespace-normal"
					on:click={() => openPopup('Hantering av personuppgifter', agreePrivacyContent)}
				/>
			</div>
		</div>

		{#if errors.general}
			<p class="text-error mb-4 text-sm font-medium">{errors.general}</p>
		{/if}

		<Button
			type="submit"
			text="Bekräfta"
			variant="primary"
			full
			disabled={$loadingStore.isLoading}
		/>
	</form>
{/if}

{#if isPopupOpen}
	<PopupWrapper
		width="600px"
		maxWidth="90vw"
		maxHeight={undefined}
		icon="CircleInfo"
		header={popupHeader}
		draggable={false}
		minimizable={false}
		on:close={closePopup}
	>
		{@html popupContent}
	</PopupWrapper>
{/if}
