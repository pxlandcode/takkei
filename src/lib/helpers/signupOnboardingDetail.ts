export type SelectOption = {
	value: number;
	label: string;
	suggested?: boolean;
	matchScore?: number;
	raw?: any;
};

export type UnavailablePackageOption = SelectOption & {
	reasons: string[];
};

export type InfoRow = {
	label: string;
	value: unknown;
	detail?: unknown;
};

export type OnboardingStepKey = 'client' | 'customer' | 'package' | 'primary_assignment';

export type MergeFieldPlanEntry = {
	key: string;
	label: string;
	sourceValue: string | null;
	targetValue: string | null;
	keptValue: string | null;
	keptFrom: 'target' | 'source' | 'empty';
	differs: boolean;
};

export function detailsFromPayload(source: any) {
	return {
		firstname: source.firstname ?? '',
		lastname: source.lastname ?? '',
		email: source.email ?? '',
		person_number: source.person_number ?? source.personnummer ?? '',
		phone: source.phone ?? '',
		streetAddress: source.streetAddress ?? '',
		zip: source.zip ?? '',
		city: source.city ?? ''
	};
}

export function positiveId(value: unknown) {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function sameId(a: unknown, b: unknown) {
	const left = positiveId(a);
	const right = positiveId(b);
	return left !== null && right !== null && left === right;
}

export function displayValue(value: unknown) {
	if (value === null || value === undefined) return '–';
	const trimmed = String(value).trim();
	return trimmed || '–';
}

export function compactParts(values: unknown[]) {
	return values
		.map((value) => (value === null || value === undefined ? '' : String(value).trim()))
		.filter(Boolean);
}

function normalizedText(value: unknown) {
	return String(value ?? '')
		.trim()
		.toLowerCase();
}

function normalizedDigits(value: unknown) {
	return String(value ?? '').replace(/\D/g, '');
}

export function sortSuggestedOptions(a: SelectOption, b: SelectOption) {
	if (a.suggested !== b.suggested) return a.suggested ? -1 : 1;
	if (a.suggested && b.suggested) return Number(b.matchScore ?? 0) - Number(a.matchScore ?? 0);
	return a.label.localeCompare(b.label, 'sv');
}

export function duplicatePlaceholder(count: number, fallback: string) {
	if (count === 1) return '1 potentiell kopia';
	if (count > 1) return `${count} potentiella kopior`;
	return fallback;
}

export function suggestedMergeHeading(count: number) {
	if (count === 1) return 'Föreslagen sammanslagning';
	return duplicatePlaceholder(count, 'Föreslagen sammanslagning');
}

export function fullName(firstname?: string, lastname?: string) {
	return `${firstname ?? ''} ${lastname ?? ''}`.trim();
}

export function formatDate(value?: string | null) {
	if (!value) return '–';
	return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium', timeStyle: 'short' }).format(
		new Date(value)
	);
}

export function resolutionLabel(value: string) {
	return value === 'pending' ? 'Åtgärd' : 'Klar';
}

export function formatCurrency(value: unknown) {
	if (value === null || value === undefined || value === '') return null;
	const numeric = Number(value);
	return Number.isFinite(numeric) ? `${numeric.toLocaleString('sv-SE')} kr` : String(value);
}

export function nextRequiredOnboardingStep(currentCase: any): OnboardingStepKey | null {
	if (currentCase.client_resolution === 'pending' || !positiveId(currentCase.resolved_client_id)) {
		return 'client';
	}
	if (
		currentCase.customer_resolution === 'pending' ||
		!positiveId(currentCase.resolved_customer_id)
	) {
		return 'customer';
	}
	if (
		currentCase.package_resolution === 'pending' ||
		(currentCase.package_resolution !== 'not_required' &&
			!positiveId(currentCase.resolved_package_id))
	) {
		return 'package';
	}
	if (currentCase.primary_assignment_resolution === 'pending') {
		return 'primary_assignment';
	}
	return null;
}

export function onboardingRequiredComplete(currentCase: any) {
	return nextRequiredOnboardingStep(currentCase) === null;
}

export function clientDisplayName(client: any) {
	return fullName(client?.firstname, client?.lastname) || `Klient ${client?.id ?? ''}`.trim();
}

export function customerDisplayName(customer: any) {
	return String(customer?.name ?? '').trim() || `Kund ${customer?.id ?? ''}`.trim();
}

export function clientDetailText(client: any) {
	const id = positiveId(client?.id);
	return compactParts([
		client?.email,
		client?.phone,
		client?.person_number,
		id ? `#${id}` : null
	]).join(' · ');
}

export function clientSuggestionReasons(payload: any, client: any) {
	const reasons: string[] = [];
	const payloadPersonNumber = normalizedDigits(payload?.person_number ?? payload?.personnummer);
	const clientPersonNumber = normalizedDigits(client?.person_number);
	const payloadEmail = normalizedText(payload?.email);
	const clientEmail = normalizedText(client?.email);
	const payloadPhone = normalizedDigits(payload?.phone);
	const clientPhone = normalizedDigits(client?.phone);
	const payloadName = normalizedText(fullName(payload?.firstname, payload?.lastname));
	const clientName = normalizedText(fullName(client?.firstname, client?.lastname));

	if (payloadPersonNumber && clientPersonNumber && payloadPersonNumber === clientPersonNumber) {
		reasons.push('Personnummer');
	}
	if (payloadEmail && clientEmail && payloadEmail === clientEmail) reasons.push('E-post');
	if (payloadPhone && clientPhone && payloadPhone === clientPhone) reasons.push('Telefon');
	if (payloadName && clientName && payloadName === clientName) reasons.push('Namn');
	return reasons;
}

export function customerDetailText(customer: any) {
	const id = positiveId(customer?.id);
	return compactParts([
		customer?.email,
		customer?.phone,
		customer?.organization_number,
		customer?.customer_no ? `Kundnr ${customer.customer_no}` : null,
		id ? `#${id}` : null
	]).join(' · ');
}

export function customerSuggestionReasons(payload: any, customer: any) {
	const reasons: string[] = [];
	const payloadEmail = normalizedText(payload?.payerEmail || payload?.email);
	const customerEmail = normalizedText(customer?.email);
	const payloadOrganizationNumber = normalizedDigits(payload?.payerOrganizationNumber);
	const customerOrganizationNumber = normalizedDigits(customer?.organization_number);
	const payloadPhone = normalizedDigits(payload?.payerPhone || payload?.phone);
	const customerPhone = normalizedDigits(customer?.phone);
	const payloadName = normalizedText(payload?.payerName);
	const customerName = normalizedText(customer?.name);

	if (
		payloadOrganizationNumber &&
		customerOrganizationNumber &&
		payloadOrganizationNumber === customerOrganizationNumber
	) {
		reasons.push('Org/personnummer');
	}
	if (payloadEmail && customerEmail && payloadEmail === customerEmail) reasons.push('E-post');
	if (payloadPhone && customerPhone && payloadPhone === customerPhone) reasons.push('Telefon');
	if (payloadName && customerName && payloadName === customerName) reasons.push('Namn');
	return reasons;
}

export function clientOptionLabel(client: any, suggested = false) {
	if (!suggested) return clientDisplayName(client);
	const details = clientDetailText(client);
	return compactParts([
		clientDisplayName(client),
		details,
		suggested ? 'föreslagen sammanslagning' : null
	]).join(' · ');
}

export function customerOptionLabel(customer: any, suggested = false) {
	if (!suggested) return customerDisplayName(customer);
	const details = customerDetailText(customer);
	return compactParts([
		customerDisplayName(customer),
		details,
		suggested ? 'föreslagen sammanslagning' : null
	]).join(' · ');
}

export function combineClientOptions(currentCase: any, allClients: any[]) {
	const byId = new Map<number, SelectOption>();
	const addClient = (client: any) => {
		const id = Number(client.id);
		if (!id || id === Number(currentCase.provisional_client_id)) return;
		byId.set(id, {
			value: id,
			label: clientOptionLabel(client),
			raw: client
		});
	};
	for (const client of allClients) addClient(client);
	return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label, 'sv'));
}

export function combineSuggestedClientOptions(currentCase: any, workspace: any) {
	return (workspace.clientCandidates ?? [])
		.map((client: any) => {
			const id = Number(client.id);
			if (!id || id === Number(currentCase.provisional_client_id)) return null;
			return {
				value: id,
				label: clientOptionLabel(client, true),
				suggested: true,
				matchScore: Number(client.match_score ?? 0),
				raw: client
			};
		})
		.filter((option: SelectOption | null): option is SelectOption => Boolean(option))
		.sort(sortSuggestedOptions);
}

export function combineCustomerOptions(currentCase: any, allCustomers: any[]) {
	const byId = new Map<number, SelectOption>();
	const addCustomer = (customer: any) => {
		const id = Number(customer.id);
		if (!id || id === Number(currentCase.provisional_customer_id)) return;
		byId.set(id, {
			value: id,
			label: customerOptionLabel(customer),
			raw: customer
		});
	};
	for (const customer of allCustomers) addCustomer(customer);
	return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label, 'sv'));
}

export function combineSuggestedCustomerOptions(currentCase: any, workspace: any) {
	return (workspace.customerCandidates ?? [])
		.map((customer: any) => {
			const id = Number(customer.id);
			if (!id || id === Number(currentCase.provisional_customer_id)) return null;
			return {
				value: id,
				label: customerOptionLabel(customer, true),
				suggested: true,
				matchScore: Number(customer.match_score ?? 0),
				raw: customer
			};
		})
		.filter((option: SelectOption | null): option is SelectOption => Boolean(option))
		.sort(sortSuggestedOptions);
}

export function clientFromCase(currentCase: any, prefix: 'resolved' | 'provisional') {
	const idKey = `${prefix}_client_id`;
	const id = positiveId(currentCase[idKey]);
	if (!id) return null;
	return {
		id,
		firstname: currentCase[`${prefix}_client_firstname`],
		lastname: currentCase[`${prefix}_client_lastname`],
		email: currentCase[`${prefix}_client_email`],
		phone: currentCase[`${prefix}_client_phone`],
		person_number: currentCase[`${prefix}_client_person_number`]
	};
}

export function findClientById(
	currentCase: any,
	workspace: any,
	allClients: any[],
	clientId: unknown
) {
	const id = positiveId(clientId);
	if (!id) return null;
	if (sameId(id, currentCase.resolved_client_id)) return clientFromCase(currentCase, 'resolved');
	if (sameId(id, currentCase.provisional_client_id))
		return clientFromCase(currentCase, 'provisional');
	const found = [...(workspace.clientCandidates ?? []), ...allClients].find((client) =>
		sameId(client.id, id)
	);
	if (found) return found;
	return { id, firstname: `Klient #${id}`, lastname: '' };
}

export function clientInfoRows(client: any) {
	return [
		{ label: 'Namn', value: clientDisplayName(client) },
		{ label: 'Klient-id', value: positiveId(client?.id) ? `#${positiveId(client.id)}` : null },
		{ label: 'E-post', value: client?.email },
		{ label: 'Telefon', value: client?.phone },
		{ label: 'Personnummer', value: client?.person_number }
	];
}

export function formatCustomerAddress(customer: any) {
	const cityLine = compactParts([customer?.invoice_zip, customer?.invoice_city]).join(' ');
	return compactParts([customer?.invoice_address, cityLine]).join(', ');
}

export function customerFromCase(currentCase: any, prefix: 'resolved' | 'provisional') {
	const idKey = `${prefix}_customer_id`;
	const id = positiveId(currentCase[idKey]);
	if (!id) return null;
	return {
		id,
		name: currentCase[`${prefix}_customer_name`],
		email: currentCase[`${prefix}_customer_email`],
		phone: currentCase[`${prefix}_customer_phone`],
		customer_no: currentCase[`${prefix}_customer_no`],
		organization_number: currentCase[`${prefix}_customer_organization_number`],
		invoice_address: currentCase[`${prefix}_customer_invoice_address`],
		invoice_zip: currentCase[`${prefix}_customer_invoice_zip`],
		invoice_city: currentCase[`${prefix}_customer_invoice_city`],
		invoice_reference: currentCase[`${prefix}_customer_invoice_reference`]
	};
}

export function findCustomerById(
	currentCase: any,
	workspace: any,
	allCustomers: any[],
	customerId: unknown
) {
	const id = positiveId(customerId);
	if (!id) return null;
	const found = [...(workspace.customerCandidates ?? []), ...allCustomers].find((customer) =>
		sameId(customer.id, id)
	);
	if (found) return found;
	if (sameId(id, currentCase.resolved_customer_id))
		return customerFromCase(currentCase, 'resolved');
	if (sameId(id, currentCase.provisional_customer_id))
		return customerFromCase(currentCase, 'provisional');
	return { id, name: `Kund #${id}` };
}

export function customerInfoRows(customer: any) {
	return [
		{ label: 'Namn', value: customerDisplayName(customer) },
		{ label: 'Kund-id', value: positiveId(customer?.id) ? `#${positiveId(customer.id)}` : null },
		{ label: 'Kundnummer', value: customer?.customer_no },
		{ label: 'E-post', value: customer?.email },
		{ label: 'Telefon', value: customer?.phone },
		{ label: 'Org/personnummer', value: customer?.organization_number },
		{ label: 'Fakturaadress', value: formatCustomerAddress(customer) },
		{ label: 'Referens', value: customer?.invoice_reference }
	];
}

export function packageRemainingSessions(pkg: any) {
	if (pkg?.remaining_sessions !== null && pkg?.remaining_sessions !== undefined) {
		const directRemaining = Number(pkg.remaining_sessions);
		if (Number.isFinite(directRemaining)) return directRemaining;
	}
	const total = Number(pkg?.total_sessions ?? pkg?.article_sessions);
	if (!Number.isFinite(total)) return null;
	const used = Number(pkg?.used_sessions_total ?? pkg?.used_sessions ?? 0);
	return total - (Number.isFinite(used) ? used : 0);
}

export function packageHasRemainingSessions(pkg: any) {
	const remaining = packageRemainingSessions(pkg);
	return remaining !== null && remaining > 0;
}

export function packageCanBeSelectedByClient(pkg: any, resolvedClientId: unknown) {
	const packageClientId = positiveId(pkg?.client_id);
	const clientId = positiveId(resolvedClientId);
	return (
		(!packageClientId || !clientId || packageClientId === clientId) &&
		packageHasRemainingSessions(pkg)
	);
}

export function packageUnavailableReasons(pkg: any, resolvedClientId: unknown) {
	const reasons: string[] = [];
	const packageClientId = positiveId(pkg?.client_id);
	const clientId = positiveId(resolvedClientId);
	if (!packageHasRemainingSessions(pkg)) reasons.push('Fullbokat');
	if (packageClientId && clientId && packageClientId !== clientId) {
		reasons.push('Personligt för annan klient');
	}
	return reasons;
}

export function packageAvailabilityOptions(packages: any[], resolvedClientId: unknown) {
	const selectable: SelectOption[] = [];
	const unavailable: UnavailablePackageOption[] = [];

	for (const item of packages ?? []) {
		const value = positiveId(item?.id);
		if (!value) continue;
		const option = {
			value,
			label: packageOptionLabel(item),
			raw: item
		};
		const reasons = packageUnavailableReasons(item, resolvedClientId);
		if (reasons.length) unavailable.push({ ...option, reasons });
		else selectable.push(option);
	}

	return { selectable, unavailable };
}

export function packageOptionLabel(item: any) {
	const total = item.total_sessions ?? item.article_sessions;
	const remainingCount = packageRemainingSessions(item);
	const remaining =
		remainingCount == null ? null : `${remainingCount} kvar${total == null ? '' : ` av ${total}`}`;
	const owner = item.is_shared
		? 'Delat'
		: item.client_name
			? `Personligt: ${item.client_name}`
			: 'Personligt';
	return compactParts([item.label ?? item.article_name, owner, remaining, `#${item.id}`]).join(
		' · '
	);
}

export function packageFromCase(currentCase: any, prefix: 'resolved' | 'provisional') {
	const idKey = prefix === 'resolved' ? 'resolved_package_id' : 'provisional_package_id';
	const nameKey = prefix === 'resolved' ? 'package_name' : 'purchased_package_name';
	const id = positiveId(currentCase[idKey]);
	if (!id) return null;
	const total =
		prefix === 'resolved'
			? currentCase.package_total_sessions
			: currentCase.purchased_package_total_sessions;
	const used =
		prefix === 'resolved'
			? currentCase.package_used_sessions
			: currentCase.purchased_package_used_sessions;
	return {
		id,
		label: currentCase[nameKey] || `Paket #${id}`,
		article_name: currentCase[nameKey],
		total_sessions: total,
		used_sessions_total: used,
		remaining_sessions: total == null ? null : Math.max(0, Number(total ?? 0) - Number(used ?? 0)),
		autogiro:
			prefix === 'resolved' ? currentCase.package_autogiro : currentCase.purchased_package_autogiro,
		paid_price:
			prefix === 'resolved'
				? currentCase.package_paid_price
				: currentCase.purchased_package_paid_price,
		client_id:
			prefix === 'resolved'
				? currentCase.package_client_id
				: currentCase.purchased_package_client_id,
		client_name:
			prefix === 'resolved'
				? fullName(currentCase.package_client_firstname, currentCase.package_client_lastname)
				: fullName(
						currentCase.purchased_package_client_firstname,
						currentCase.purchased_package_client_lastname
					),
		is_shared:
			prefix === 'resolved'
				? !currentCase.package_client_id
				: !currentCase.purchased_package_client_id
	};
}

export function findPackageById(
	currentCase: any,
	packageOptions: SelectOption[],
	packageId: unknown
) {
	const id = positiveId(packageId);
	if (!id) return null;
	const option = packageOptions.find((item) => sameId(item.value, id));
	if (option?.raw) return option.raw;
	if (sameId(id, currentCase.resolved_package_id)) return packageFromCase(currentCase, 'resolved');
	if (sameId(id, currentCase.provisional_package_id))
		return packageFromCase(currentCase, 'provisional');
	return { id, label: `Paket #${id}`, article_name: `Paket #${id}` };
}

export function packageInfoRows(pkg: any) {
	const total = pkg?.total_sessions ?? pkg?.article_sessions;
	const used = pkg?.used_sessions_total ?? pkg?.used_sessions ?? 0;
	const remaining =
		pkg?.remaining_sessions ?? (total == null ? null : Math.max(0, Number(total) - Number(used)));
	const clientName = pkg?.client_name || fullName(pkg?.client_firstname, pkg?.client_lastname);
	return [
		{ label: 'Paket-id', value: positiveId(pkg?.id) ? `#${positiveId(pkg.id)}` : null },
		{ label: 'Paket', value: pkg?.article_name ?? pkg?.label },
		{
			label: 'Typ',
			value:
				pkg?.is_shared || !pkg?.client_id ? 'Delat kundpaket' : `Personligt: ${clientName || '–'}`
		},
		{
			label: 'Saldo',
			value: remaining == null ? null : `${remaining} kvar${total == null ? '' : ` av ${total}`}`
		},
		{ label: 'Betalning', value: pkg?.autogiro ? 'Autogiro' : 'Faktura' },
		{ label: 'Pris', value: formatCurrency(pkg?.paid_price) }
	];
}

export function clientMergeFollowupRows(currentCase: any) {
	const rows: InfoRow[] = [];
	const provisionalCustomer = customerFromCase(currentCase, 'provisional');
	const provisionalPackage = packageFromCase(currentCase, 'provisional');
	if (provisionalCustomer) {
		rows.push({
			label: 'Kund',
			value: customerDisplayName(provisionalCustomer),
			detail: customerDetailText(provisionalCustomer) || 'Kopplas till målklienten'
		});
	}
	if (provisionalPackage) {
		rows.push({
			label: 'Paket',
			value: provisionalPackage.article_name ?? provisionalPackage.label,
			detail: packageOptionLabel(provisionalPackage)
		});
	}
	return rows;
}

export function primaryAssignmentRows(
	currentCase: any,
	trainerOptions: SelectOption[],
	locationOptions: SelectOption[]
) {
	const trainerDisplayNameById = (trainerId: unknown) => {
		const id = positiveId(trainerId);
		if (!id) return null;
		const option = trainerOptions.find((trainer) => sameId(trainer.value, id));
		if (option?.label) return option.label;
		return `Tränare #${id}`;
	};
	const locationDisplayNameById = (locationId: unknown) => {
		const id = positiveId(locationId);
		if (!id) return null;
		const option = locationOptions.find((location) => sameId(location.value, id));
		if (option?.label) return option.label;
		return `Lokal #${id}`;
	};
	return [
		{
			label: 'Primär tränare',
			value:
				currentCase.primary_assignment_resolution === 'skipped'
					? 'Ej vald'
					: trainerDisplayNameById(currentCase.resolved_primary_trainer_id)
		},
		{
			label: 'Primär lokal',
			value:
				currentCase.primary_assignment_resolution === 'skipped'
					? 'Ej vald'
					: locationDisplayNameById(currentCase.resolved_primary_location_id)
		}
	];
}

export function onboardingSummaryRows(
	currentCase: any,
	selectedClientInfo: any,
	selectedCustomerInfo: any,
	selectedPackageInfo: any,
	trainerOptions: SelectOption[],
	locationOptions: SelectOption[]
) {
	const assignmentRows = primaryAssignmentRows(currentCase, trainerOptions, locationOptions);
	const packageValue =
		currentCase.package_resolution === 'not_required'
			? 'Inget paket'
			: selectedPackageInfo
				? selectedPackageInfo.article_name ||
					selectedPackageInfo.label ||
					`Paket #${selectedPackageInfo.id}`
				: null;
	return [
		{
			label: 'Klient',
			value: selectedClientInfo ? clientDisplayName(selectedClientInfo) : null,
			detail: selectedClientInfo ? clientDetailText(selectedClientInfo) : null
		},
		{
			label: 'Kund',
			value: selectedCustomerInfo ? customerDisplayName(selectedCustomerInfo) : null,
			detail: selectedCustomerInfo ? customerDetailText(selectedCustomerInfo) : null
		},
		{
			label: 'Paket',
			value: packageValue,
			detail:
				currentCase.package_resolution === 'not_required'
					? 'Aktivt valt att fortsätta utan paket'
					: selectedPackageInfo
						? packageOptionLabel(selectedPackageInfo)
						: null
		},
		{
			label: 'Primär tränare',
			value: assignmentRows[0]?.value
		},
		{
			label: 'Primär lokal',
			value: assignmentRows[1]?.value
		},
		{
			label: 'Bokning',
			value: currentCase.booking_id ? `#${currentCase.booking_id}` : 'Ej bokad',
			detail: currentCase.booking_id ? 'Första bokning kopplad' : 'Valfritt'
		}
	];
}

export function mergeImpactCount(preview: any) {
	return Object.values(preview?.impact?.counts ?? {}).reduce(
		(sum: number, value: any) => sum + Number(value || 0),
		0
	);
}

export function mergeFieldValue(value: string | null | undefined) {
	return value?.trim() ? value : 'Saknas';
}

export function mergeFieldExplanation(field: MergeFieldPlanEntry) {
	if (field.keptFrom === 'source') return 'Målprofilen saknar värde. Fylls från registreringen.';
	if (field.keptFrom === 'empty') return 'Saknas på båda profilerna.';
	if (!field.differs) return 'Samma värde på båda profilerna.';
	return `Målprofilens värde behålls. Registreringen har: ${mergeFieldValue(field.sourceValue)}.`;
}
