<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Icon from '../../../../components/bits/icon-component/Icon.svelte';
	import BookingPopup from '../../../../components/ui/bookingPopup/BookingPopup.svelte';
	import PackagePopup from '../../../../components/ui/packagePopup/PackagePopup.svelte';
	import BookingShortcutStep from '../../../../components/ui/signupOnboarding/detail/BookingShortcutStep.svelte';
	import ClientStep from '../../../../components/ui/signupOnboarding/detail/ClientStep.svelte';
	import CustomerStep from '../../../../components/ui/signupOnboarding/detail/CustomerStep.svelte';
	import PackageStep from '../../../../components/ui/signupOnboarding/detail/PackageStep.svelte';
	import PrimaryAssignmentStep from '../../../../components/ui/signupOnboarding/detail/PrimaryAssignmentStep.svelte';
	import SubmittedDetailsCard from '../../../../components/ui/signupOnboarding/detail/SubmittedDetailsCard.svelte';
	import { openPopup, closePopup } from '$lib/stores/popupStore';
	import { signupOnboardingStore } from '$lib/stores/signupOnboardingStore';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import type { SignupOnboardingActionInput } from '$lib/types/signupOnboarding';
	import {
		combineClientOptions,
		combineCustomerOptions,
		combineSuggestedClientOptions,
		combineSuggestedCustomerOptions,
		detailsFromPayload,
		findClientById,
		findCustomerById,
		findPackageById,
		formatDate,
		fullName,
		packageCanBeSelectedByClient,
		packageOptionLabel,
		positiveId,
		sameId,
		type SelectOption
	} from '$lib/helpers/signupOnboardingDetail';
	import type { ComponentType } from 'svelte';

	export let data: {
		workspace: any;
		clients?: any[];
		customers?: any[];
		trainers?: any[];
		locations?: any[];
	};

	let workspace = data.workspace;
	let busy = false;
	let allClients: any[] = Array.isArray(data.clients) ? data.clients : [];
	let allCustomers: any[] = Array.isArray(data.customers) ? data.customers : [];
	let packageOptions: SelectOption[] = [];
	let selectedClientId: number | '' = '';
	let selectedCustomerId: number | '' = '';
	let selectedPackageId: number | '' = '';
	let selectedPrimaryTrainerId: number | '' = '';
	let selectedPrimaryLocationId: number | '' = '';
	let clientPreview: any = null;
	let customerPreview: any = null;
	let loadingClientOptions = !Array.isArray(data.clients);
	let loadingCustomerOptions = !Array.isArray(data.customers);
	let loadingPackages = false;
	let editingDetails = false;
	let detailErrors: Record<string, string> = {};
	let detailForm = detailsFromPayload(data.workspace.case.submitted_payload ?? {});
	let lastResolvedCustomerId: number | null = null;
	let lastResolvedPackageId: number | null = null;
	let lastPackageCustomerId: number | null = null;
	let lastPrimaryAssignmentKey = '';
	let clientPreviewRequestId = 0;
	let customerPreviewRequestId = 0;

	$: currentCase = workspace.case;
	$: payload = currentCase.submitted_payload ?? {};
	$: isOpen = ['new', 'in_progress', 'waiting'].includes(currentCase.status);
	$: resolvedClientId = currentCase.resolved_client_id;
	$: resolvedCustomerId = currentCase.resolved_customer_id;
	$: clientStepDone = currentCase.client_resolution !== 'pending' && Boolean(resolvedClientId);
	$: customerStepDone =
		currentCase.customer_resolution !== 'pending' && Boolean(resolvedCustomerId);
	$: canResolvePackageStep = clientStepDone && customerStepDone;
	$: clientOptions = combineClientOptions(currentCase, allClients);
	$: customerOptions = combineCustomerOptions(currentCase, allCustomers);
	$: trainerOptions = (data.trainers ?? []).map((trainer: any) => ({
		value: Number(trainer.id),
		label: fullName(trainer.firstname, trainer.lastname) || `Tränare ${trainer.id}`,
		raw: trainer
	}));
	$: locationOptions = (data.locations ?? []).map((location: any) => ({
		value: Number(location.id),
		label: String(location.name ?? '').trim() || `Lokal ${location.id}`,
		raw: location
	}));
	$: suggestedClientOptions = combineSuggestedClientOptions(currentCase, workspace);
	$: suggestedCustomerOptions = combineSuggestedCustomerOptions(currentCase, workspace);
	$: suggestedPackageOptions = packageOptions;
	$: clientMergePlaceholder = loadingClientOptions ? 'Hämtar klienter...' : 'Välj målklient';
	$: customerMergePlaceholder = loadingCustomerOptions
		? 'Hämtar kunder...'
		: currentCase.provisional_customer_id
			? 'Välj målkund'
			: 'Välj kund';
	$: selectedClientInfo =
		findClientById(currentCase, workspace, allClients, selectedClientId) ??
		findClientById(currentCase, workspace, allClients, resolvedClientId) ??
		(!selectedClientId
			? findClientById(currentCase, workspace, allClients, currentCase.provisional_client_id)
			: null);
	$: selectedCustomerInfo =
		findCustomerById(currentCase, workspace, allCustomers, selectedCustomerId) ??
		findCustomerById(currentCase, workspace, allCustomers, resolvedCustomerId) ??
		(!selectedCustomerId
			? findCustomerById(currentCase, workspace, allCustomers, currentCase.provisional_customer_id)
			: null);
	$: selectedPackageInfo = selectedPackageId
		? findPackageById(currentCase, packageOptions, selectedPackageId)
		: currentCase.package_resolution !== 'pending'
			? findPackageById(currentCase, packageOptions, currentCase.resolved_package_id)
			: null;
	$: selectedPackageIsCurrent =
		Boolean(selectedPackageId) &&
		Boolean(currentCase.resolved_package_id) &&
		Number(selectedPackageId) === Number(currentCase.resolved_package_id);
	$: packageActionText =
		currentCase.package_resolution === 'pending' && selectedPackageIsCurrent
			? 'Bekräfta valt paket'
			: currentCase.resolved_package_id
				? 'Ändra paket'
				: 'Koppla paket';
	$: canSavePackage = Boolean(selectedPackageId) && currentCase.package_resolution === 'pending';
	$: purchasedPackageRemaining = Math.max(
		0,
		Number(currentCase.purchased_package_total_sessions ?? 0) -
			Number(currentCase.purchased_package_used_sessions ?? 0)
	);
	$: {
		const nextCustomerId = positiveId(resolvedCustomerId);
		if (nextCustomerId !== lastResolvedCustomerId) {
			lastResolvedCustomerId = nextCustomerId;
			selectedCustomerId = nextCustomerId ?? '';
			customerPreview = null;
		}
	}
	$: {
		const nextPackageId = positiveId(currentCase.resolved_package_id);
		if (nextPackageId !== lastResolvedPackageId) {
			lastResolvedPackageId = nextPackageId;
			selectedPackageId = currentCase.package_resolution === 'pending' ? '' : (nextPackageId ?? '');
		}
	}
	$: {
		const primaryKey = [
			currentCase.primary_assignment_resolution,
			currentCase.resolved_primary_trainer_id ?? '',
			currentCase.resolved_primary_location_id ?? ''
		].join(':');
		if (primaryKey !== lastPrimaryAssignmentKey) {
			lastPrimaryAssignmentKey = primaryKey;
			selectedPrimaryTrainerId = positiveId(currentCase.resolved_primary_trainer_id) ?? '';
			selectedPrimaryLocationId = positiveId(currentCase.resolved_primary_location_id) ?? '';
		}
	}
	$: if (
		browser &&
		isOpen &&
		canResolvePackageStep &&
		resolvedCustomerId &&
		Number(resolvedCustomerId) !== lastPackageCustomerId
	) {
		lastPackageCustomerId = Number(resolvedCustomerId);
		void loadPackages(Number(resolvedCustomerId), true);
	}

	function selectCustomerOption(option: SelectOption) {
		selectCustomerTarget(option.value);
	}

	function selectCustomerTarget(targetId: unknown) {
		const id = positiveId(targetId);
		selectedCustomerId = id ?? '';
		customerPreview = null;
		if (id) {
			void loadPackages(id);
			if (currentCase.provisional_customer_id) void previewCustomerMerge(id);
		}
	}

	function selectClientSuggestion(option: SelectOption) {
		selectClientTarget(option.value);
	}

	function selectClientTarget(targetId: unknown) {
		const id = positiveId(targetId);
		selectedClientId = id ?? '';
		clientPreview = null;
		if (id) void previewClientMerge(id);
	}

	function handleClientTargetChange(event: CustomEvent<{ value: unknown }>) {
		selectClientTarget(event.detail?.value ?? selectedClientId);
	}

	function handleCustomerTargetChange(event: CustomEvent<{ value: unknown }>) {
		selectCustomerTarget(event.detail?.value ?? selectedCustomerId);
	}

	function clientInfoHeading() {
		if (currentCase.client_resolution !== 'pending') return 'Löst klient';
		if (selectedClientId) return 'Vald målklient';
		return 'Preliminär klient';
	}

	function handlePrimaryTrainerChange(event: CustomEvent<{ value: unknown }>) {
		const trainerId = positiveId(event.detail?.value);
		if (!trainerId || selectedPrimaryLocationId) return;
		const trainer = (data.trainers ?? []).find((item: any) => sameId(item.id, trainerId));
		const defaultLocationId = positiveId(trainer?.default_location_id);
		if (defaultLocationId) selectedPrimaryLocationId = defaultLocationId;
	}

	function savePrimaryAssignment() {
		if (!selectedPrimaryTrainerId || !selectedPrimaryLocationId) return;
		void runAction({
			type: 'set_primary_assignment',
			primaryTrainerId: Number(selectedPrimaryTrainerId),
			primaryLocationId: Number(selectedPrimaryLocationId)
		});
	}

	function skipPrimaryAssignment() {
		void runAction({ type: 'skip_primary_assignment' });
	}

	function selectPackageOption(option: SelectOption) {
		selectedPackageId = Number(option.value);
	}

	function loadOptions() {
		if (!browser) return;
		if (!Array.isArray(data.clients)) void loadClientOptions();
		if (!Array.isArray(data.customers)) void loadCustomerOptions();
	}

	async function loadClientOptions() {
		loadingClientOptions = true;
		try {
			const response = await fetch('/api/clients?short=true&limit=5000', { cache: 'no-store' });
			if (!response.ok) throw new Error('Kunde inte hämta klienter');
			allClients = await response.json();
		} catch (error) {
			allClients = [];
			console.error('Failed to load onboarding clients:', error);
		} finally {
			loadingClientOptions = false;
		}
	}

	async function loadCustomerOptions() {
		loadingCustomerOptions = true;
		try {
			const response = await fetch('/api/customers?limit=5000', { cache: 'no-store' });
			if (!response.ok) throw new Error('Kunde inte hämta kunder');
			allCustomers = await response.json();
		} catch (error) {
			allCustomers = [];
			console.error('Failed to load onboarding customers:', error);
		} finally {
			loadingCustomerOptions = false;
		}
	}

	async function loadPackages(customerId: number, preserveSelection = false) {
		if (!browser) return;
		loadingPackages = true;
		if (!preserveSelection) selectedPackageId = '';
		packageOptions = [];
		try {
			const response = await fetch(`/api/customers/${customerId}/package-assignments`);
			if (!response.ok) throw new Error('Kunde inte hämta paket');
			const result = await response.json();
			packageOptions = (result.packages ?? [])
				.filter((item: any) => packageCanBeSelectedByClient(item, resolvedClientId))
				.map((item: any) => ({
					value: Number(item.id),
					label: packageOptionLabel(item),
					raw: item
				}));
			if (
				currentCase.package_resolution !== 'pending' &&
				currentCase.resolved_package_id &&
				packageOptions.some((option) => sameId(option.value, currentCase.resolved_package_id))
			) {
				selectedPackageId = Number(currentCase.resolved_package_id);
			}
		} catch (error) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte hämta paket',
				description: error instanceof Error ? error.message : 'Försök igen.'
			});
		} finally {
			loadingPackages = false;
		}
	}

	async function handlePackageCreated(result?: { id?: number }) {
		closePopup();
		const customerId = positiveId(resolvedCustomerId);
		if (!customerId) return;
		await loadPackages(customerId);
		const createdId = positiveId(result?.id);
		if (createdId && packageOptions.some((option) => sameId(option.value, createdId))) {
			selectedPackageId = createdId;
		}
	}

	function openCreatePackage() {
		const customerId = positiveId(resolvedCustomerId);
		if (!customerId) return;
		openPopup({
			header: 'Lägg till paket',
			icon: 'Plus',
			component: PackagePopup as unknown as ComponentType,
			width: '1000px',
			props: {
				customerId,
				onSave: handlePackageCreated
			}
		});
	}

	async function reloadWorkspace() {
		const response = await fetch(`/api/onboarding/${currentCase.id}`, { cache: 'no-store' });
		if (response.ok) {
			workspace = await response.json();
			detailForm = detailsFromPayload(workspace.case.submitted_payload ?? {});
		}
	}

	async function runAction(action: SignupOnboardingActionInput) {
		if (busy) return;
		busy = true;
		try {
			const response = await fetch(`/api/onboarding/${currentCase.id}/actions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...action, expectedUpdatedAt: currentCase.updated_at })
			});
			const result = await response.json();
			if (!response.ok) {
				if (response.status === 409 && result.code === 'case_changed') await reloadWorkspace();
				throw new Error(result.error || 'Kunde inte uppdatera registreringen');
			}
			workspace = result;
			clientPreview = null;
			customerPreview = null;
			if (action.type === 'update_details') {
				detailForm = detailsFromPayload(result.case.submitted_payload ?? {});
				editingDetails = false;
				detailErrors = {};
			}
			await signupOnboardingStore.refresh();
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Registreringen uppdaterad',
				description: 'Ändringen är sparad.'
			});
		} catch (error) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte uppdatera',
				description: error instanceof Error ? error.message : 'Försök igen.'
			});
		} finally {
			busy = false;
		}
	}

	function cancelDetailEdit() {
		detailForm = detailsFromPayload(payload);
		detailErrors = {};
		editingDetails = false;
	}

	function saveDetails() {
		detailErrors = {};
		for (const field of [
			'firstname',
			'lastname',
			'email',
			'person_number',
			'phone',
			'streetAddress',
			'zip',
			'city'
		]) {
			if (!String(detailForm[field as keyof typeof detailForm] ?? '').trim()) {
				detailErrors[field] = 'Fältet är obligatoriskt';
			}
		}
		if (Object.keys(detailErrors).length) return;
		void runAction({ type: 'update_details', details: { ...detailForm } });
	}

	async function previewClientMerge(targetId: number | '' = selectedClientId) {
		const target = positiveId(targetId);
		if (!target || !currentCase.provisional_client_id) return;
		const requestId = ++clientPreviewRequestId;
		const response = await fetch(
			`/api/clients/${currentCase.provisional_client_id}/merge?targetClientId=${target}`
		);
		const result = await response.json();
		if (requestId !== clientPreviewRequestId || !sameId(target, selectedClientId)) return;
		if (!response.ok) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte förhandsgranska',
				description: result.error
			});
			return;
		}
		clientPreview = result;
	}

	async function previewCustomerMerge(targetId: number | '' = selectedCustomerId) {
		const target = positiveId(targetId);
		if (!target || !currentCase.provisional_customer_id) return;
		const requestId = ++customerPreviewRequestId;
		const response = await fetch(
			`/api/customers/${currentCase.provisional_customer_id}/merge?targetCustomerId=${target}`
		);
		const result = await response.json();
		if (requestId !== customerPreviewRequestId || !sameId(target, selectedCustomerId)) return;
		if (!response.ok) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte förhandsgranska',
				description: result.error
			});
			return;
		}
		customerPreview = result;
	}

	function openBooking() {
		if (!clientStepDone || !resolvedClientId) return;
		openPopup({
			header: 'Boka första träning',
			icon: 'Plus',
			component: BookingPopup,
			maxWidth: '650px',
			props: { clientId: resolvedClientId },
			listeners: {
				created: (event: CustomEvent<{ bookingIds?: number[] }>) => {
					const bookingId = event.detail?.bookingIds?.[0];
					if (bookingId) void runAction({ type: 'attach_booking', bookingId });
				}
			}
		});
	}

	function goToClientProfile() {
		if (clientStepDone && resolvedClientId) void goto(`/clients/${resolvedClientId}`);
	}

	onMount(loadOptions);
</script>

<div class="custom-scrollbar h-full overflow-y-auto bg-[#f8f9fb]">
	<div class="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
		<header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<button
					class="mb-2 text-sm text-gray-500 hover:text-gray-900"
					on:click={() => goto('/clients?view=new')}
				>
					← Nya klienter
				</button>
				<div class="flex items-center gap-2">
					<div class="bg-text flex h-8 w-8 items-center justify-center rounded-full text-white">
						<Icon icon="Person" size="16px" />
					</div>
					<h1 class="text-2xl font-bold text-gray-900">
						{payload.firstname}
						{payload.lastname}
					</h1>
				</div>
				<p class="mt-1 text-sm text-gray-500">Registrerad {formatDate(currentCase.created_at)}</p>
			</div>
		</header>

		<section>
			<div class="space-y-4">
				<SubmittedDetailsCard
					{currentCase}
					{payload}
					{isOpen}
					{busy}
					bind:editingDetails
					bind:detailForm
					{detailErrors}
					onCancel={cancelDetailEdit}
					onSave={saveDetails}
				/>

				<ClientStep
					{currentCase}
					{isOpen}
					{busy}
					{selectedClientInfo}
					bind:selectedClientId
					{suggestedClientOptions}
					{clientOptions}
					{loadingClientOptions}
					{clientMergePlaceholder}
					{clientPreview}
					clientInfoHeading={clientInfoHeading()}
					{runAction}
					{selectClientSuggestion}
					{handleClientTargetChange}
					{previewClientMerge}
				/>

				<CustomerStep
					{currentCase}
					{isOpen}
					{busy}
					{clientStepDone}
					{selectedCustomerInfo}
					bind:selectedCustomerId
					{suggestedCustomerOptions}
					{customerOptions}
					{customerMergePlaceholder}
					{customerPreview}
					{runAction}
					{selectCustomerOption}
					{handleCustomerTargetChange}
					{previewCustomerMerge}
				/>

				<PackageStep
					{currentCase}
					{isOpen}
					{busy}
					{canResolvePackageStep}
					{selectedPackageInfo}
					bind:selectedPackageId
					{suggestedPackageOptions}
					{packageOptions}
					{packageActionText}
					{canSavePackage}
					{purchasedPackageRemaining}
					{loadingPackages}
					{selectPackageOption}
					{runAction}
					{openCreatePackage}
				/>

				<PrimaryAssignmentStep
					{currentCase}
					{isOpen}
					{busy}
					{clientStepDone}
					{trainerOptions}
					{locationOptions}
					bind:selectedPrimaryTrainerId
					bind:selectedPrimaryLocationId
					{handlePrimaryTrainerChange}
					{savePrimaryAssignment}
					{skipPrimaryAssignment}
				/>

				<BookingShortcutStep
					{currentCase}
					{clientStepDone}
					{busy}
					{openBooking}
					{goToClientProfile}
				/>
			</div>
		</section>
	</div>
</div>
