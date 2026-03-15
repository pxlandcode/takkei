<script lang="ts">
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import Button from '../../bits/button/Button.svelte';
	import OptionButton from '../../bits/optionButton/OptionButton.svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import Input from '../../bits/Input/Input.svelte';
	import DatePicker from '../../bits/datePicker/DatePicker.svelte';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';

	type Scope = 'client' | 'customer';
	type PackageStatusFilter = 'all' | 'linked' | 'missing';

	type WorkspacePackage = {
		id: number;
		customer_id: number;
		customer_name: string;
		client_id: number | null;
		client_name: string | null;
		article_name: string;
		label: string;
		frozen_from_date: string | null;
		validity_start_date: string | null;
		validity_end_date: string | null;
		total_sessions: number | null;
		used_sessions_total: number;
		remaining_sessions: number | null;
		is_personal: boolean;
		is_shared: boolean;
	};

	type WorkspaceBooking = {
		id: number;
		start_time: string | null;
		booking_date: string | null;
		status: string | null;
		client_id: number;
		client_name: string;
		trainer_name: string | null;
		location_name: string | null;
		current_package_id: number | null;
		current_package_label: string | null;
		added_to_package_date: string | null;
		internal_education: boolean;
		package_status: 'linked' | 'missing';
	};

	type WorkspacePayload = {
		scope: Scope;
		subject: { id: number; name: string };
		packages: WorkspacePackage[];
		bookings: WorkspaceBooking[];
		summary: { all: number; linked: number; missing: number };
	};

	type ValidationRow = {
		bookingId: number;
		currentPackageId: number | null;
		targetPackageId: number | null;
		ok: boolean;
		reason: string | null;
		changed: boolean;
	};

	export let scope: Scope;
	export let scopeId: number;
	export let preselectedPackageId: number | null = null;
	export let initialFilter: PackageStatusFilter = 'all';

	const dispatch = createEventDispatcher();

	const filterOptions = [
		{ value: 'all', label: 'Alla' },
		{ value: 'selected', label: 'Valt paket' },
		{ value: 'linked', label: 'Har paket' },
		{ value: 'missing', label: 'Saknar paket' }
	];

	let loading = true;
	let submitting = false;
	let error: string | null = null;
	let successMessage: string | null = null;
	let validationRows: ValidationRow[] = [];
	let workspace: WorkspacePayload | null = null;
	let selectedFilter = filterOptions[0];
	let search = '';
	let dateFrom = '';
	let dateTo = '';
	let selectedPackageFilter = '';
	let selectedClientFilter = '';
	let selectedTargetPackageId = '';
	let moveDestinationPackageId = '';
	let selectedBookingIds: number[] = [];
	let showFilters = false;
	let showPackages = false;
	let showActions = false;
	let visibleCount = 50;
	let tableContainer: HTMLDivElement;

	function apiBase() {
		return scope === 'client'
			? `/api/clients/${scopeId}/package-assignments`
			: `/api/customers/${scopeId}/package-assignments`;
	}

	function setDefaultFilters() {
		selectedTargetPackageId = preselectedPackageId ? String(preselectedPackageId) : '';

		// When opening with a preselected package, show its bookings and open package section
		if (preselectedPackageId) {
			selectedFilter =
				filterOptions.find((option) => option.value === 'linked') ?? filterOptions[0];
			selectedPackageFilter = String(preselectedPackageId);
			showPackages = true;
		} else {
			selectedFilter =
				filterOptions.find((option) => option.value === initialFilter) ?? filterOptions[0];
			selectedPackageFilter = '';
		}
	}

	function formatDateTime(value: string | null | undefined) {
		if (!value) return '—';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return new Intl.DateTimeFormat('sv-SE', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
	}

	function formatDate(value: string | null | undefined) {
		if (!value) return '—';
		const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
		return match ? match[0] : String(value);
	}

	function formatSaldo(value: number | null | undefined) {
		if (value === null || value === undefined || Number.isNaN(value)) return '—';
		return String(value);
	}

	function packageMeta(pkg: WorkspacePackage) {
		const parts = [pkg.is_shared ? 'Delat' : 'Personligt'];
		if (pkg.client_name) parts.push(pkg.client_name);
		if (pkg.frozen_from_date) parts.push(`Fryst från ${formatDate(pkg.frozen_from_date)}`);
		if (pkg.validity_start_date || pkg.validity_end_date) {
			parts.push(
				`Giltigt ${pkg.validity_start_date ? formatDate(pkg.validity_start_date) : '—'} - ${pkg.validity_end_date ? formatDate(pkg.validity_end_date) : '—'}`
			);
		}
		return parts.join(' • ');
	}

	function resetSelection() {
		selectedBookingIds = [];
		validationRows = [];
	}

	async function loadWorkspace() {
		loading = true;
		error = null;
		try {
			const res = await fetch(apiBase());
			const text = await res.text();
			const payload = text ? JSON.parse(text) : null;
			if (!res.ok) {
				throw new Error(payload?.error || text || 'Kunde inte hämta paketbokningar');
			}
			workspace = payload;
			if (!selectedTargetPackageId && preselectedPackageId) {
				selectedTargetPackageId = String(preselectedPackageId);
			}
		} catch (err: any) {
			error = err?.message ?? 'Kunde inte hämta paketbokningar';
		} finally {
			loading = false;
		}
	}

	async function postJson(path: string, body: unknown) {
		const res = await fetch(path, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		const text = await res.text();
		let payload: any = null;
		try {
			payload = text ? JSON.parse(text) : null;
		} catch {
			payload = null;
		}
		if (!res.ok) {
			const errorMessage = payload?.error || text || 'Något gick fel';
			throw new Error(errorMessage);
		}
		return payload;
	}

	function visibleSelectionIds() {
		return filteredBookings.map((booking) => booking.id);
	}

	function toggleBooking(id: number) {
		selectedBookingIds = selectedBookingIds.includes(id)
			? selectedBookingIds.filter((item) => item !== id)
			: [...selectedBookingIds, id];
	}

	function toggleAllVisible() {
		const ids = visibleSelectionIds();
		const allSelected = ids.length > 0 && ids.every((id) => selectedBookingIds.includes(id));
		selectedBookingIds = allSelected
			? selectedBookingIds.filter((id) => !ids.includes(id))
			: Array.from(new Set([...selectedBookingIds, ...ids]));
	}

	function buildChanges(mode: 'assign' | 'move' | 'remove') {
		const selectedRows = allSelectedBookings;
		if (!selectedRows.length) {
			throw new Error('Välj minst en bokning först.');
		}

		if (mode === 'assign') {
			if (!selectedTargetPackageId) throw new Error('Välj vilket paket bokningarna ska läggas på.');
			if (selectedRows.some((row) => row.current_package_id !== null)) {
				throw new Error('Lägg till på paket kan bara användas för bokningar som saknar paket.');
			}
			return selectedRows.map((row) => ({
				bookingId: row.id,
				targetPackageId: Number(selectedTargetPackageId)
			}));
		}

		if (mode === 'move') {
			if (!moveDestinationPackageId)
				throw new Error('Välj vilket paket bokningarna ska flyttas till.');
			if (selectedRows.some((row) => row.current_package_id === null)) {
				throw new Error('Flytta till paket kräver att alla valda bokningar redan har ett paket.');
			}
			return selectedRows.map((row) => ({
				bookingId: row.id,
				targetPackageId: Number(moveDestinationPackageId)
			}));
		}

		if (selectedRows.some((row) => row.current_package_id === null)) {
			throw new Error('Ta bort från paket kräver att alla valda bokningar redan har ett paket.');
		}
		return selectedRows.map((row) => ({ bookingId: row.id, targetPackageId: null }));
	}

	async function runAction(mode: 'assign' | 'move' | 'remove') {
		submitting = true;
		error = null;
		successMessage = null;
		validationRows = [];

		try {
			const changes = buildChanges(mode);
			const validation = await postJson(`${apiBase()}/validate`, { changes });
			validationRows = Array.isArray(validation?.rows)
				? validation.rows.filter((row: ValidationRow) => !row.ok)
				: [];
			if (!validation?.ok) {
				throw new Error('Ändringen kunde inte valideras. Se listan nedan.');
			}

			const result = await postJson(`${apiBase()}/apply`, { changes });
			const appliedCount = Number(result?.appliedCount ?? 0);
			successMessage =
				appliedCount > 0
					? `${appliedCount} bokning${appliedCount === 1 ? '' : 'ar'} uppdaterades.`
					: 'Inga ändringar behövdes.';
			resetSelection();
			await loadWorkspace();
			dispatch('applied', result);
		} catch (err: any) {
			error = err?.message ?? 'Något gick fel';
		} finally {
			submitting = false;
		}
	}

	async function removeSingle(bookingId: number) {
		selectedBookingIds = [bookingId];
		await tick();
		await runAction('remove');
	}

	onMount(async () => {
		setDefaultFilters();
		await loadWorkspace();
	});

	$: clientOptions = workspace
		? Array.from(
				new Map(
					workspace.bookings.map((booking) => [booking.client_id, booking.client_name])
				).entries()
			)
				.map(([id, name]) => ({ id, name }))
				.sort((left, right) => left.name.localeCompare(right.name, 'sv'))
		: [];

	$: packageOptions = workspace?.packages ?? [];
	$: sortedPackageOptions = [...packageOptions].sort((a, b) => b.id - a.id);
	$: packageDropdownOptions = packageOptions.map((pkg) => ({
		label: pkg.label,
		value: String(pkg.id)
	}));
	$: clientDropdownOptions = clientOptions.map((c) => ({ label: c.name, value: String(c.id) }));
	$: selectedPackageBookingsCount = selectedTargetPackageId
		? (workspace?.bookings ?? []).filter(
				(b) => String(b.current_package_id ?? '') === selectedTargetPackageId
			).length
		: 0;
	$: filterOptionsWithCounts = workspace
		? filterOptions
				.filter((option) => option.value !== 'selected' || selectedTargetPackageId)
				.map((option) => ({
					...option,
					label:
						option.value === 'all'
							? `Alla (${workspace.summary.all})`
							: option.value === 'selected'
								? `Valt paket (${selectedPackageBookingsCount})`
								: option.value === 'linked'
									? `Har paket (${workspace.summary.linked})`
									: `Saknar paket (${workspace.summary.missing})`
				}))
		: filterOptions.filter((option) => option.value !== 'selected');
	$: if (!filterOptionsWithCounts.some((option) => option.value === selectedFilter?.value)) {
		selectedFilter = filterOptionsWithCounts[0];
	}
	$: selectedPackage =
		workspace?.packages.find((pkg) => String(pkg.id) === selectedTargetPackageId) ?? null;
	$: isSelectedPackageFull =
		selectedPackage !== null &&
		selectedPackage.remaining_sessions !== null &&
		selectedPackage.remaining_sessions <= 0;
	$: allSelectedBookings = (workspace?.bookings ?? []).filter((booking) =>
		selectedBookingIds.includes(booking.id)
	);
	$: selectedBookingsClientIds = new Set(allSelectedBookings.map((b) => b.client_id));
	$: moveDestinationOptions = packageOptions
		.filter((pkg) => {
			// Exclude currently selected package
			if (String(pkg.id) === selectedTargetPackageId) return false;
			// Must have positive saldo
			if (pkg.remaining_sessions === null || pkg.remaining_sessions <= 0) return false;
			// Must have enough space for all selected bookings
			if (selectedBookingIds.length > 0 && pkg.remaining_sessions < selectedBookingIds.length)
				return false;
			// Personal packages can only receive bookings from the same client
			if (pkg.is_personal && pkg.client_id !== null) {
				// All selected bookings must be from the same client as the personal package
				if (selectedBookingsClientIds.size === 0) return true; // No selection yet, show all
				if (selectedBookingsClientIds.size > 1) return false; // Multiple clients selected, can't use personal package
				const selectedClientId = [...selectedBookingsClientIds][0];
				if (selectedClientId !== pkg.client_id) return false;
			}
			return true;
		})
		.map((pkg) => {
			const label =
				pkg.is_personal && pkg.client_name
					? `${pkg.article_name} - ${pkg.client_name} (saldo: ${formatSaldo(pkg.remaining_sessions)})`
					: `${pkg.article_name} (saldo: ${formatSaldo(pkg.remaining_sessions)})`;
			return { label, value: String(pkg.id) };
		});
	$: filteredBookings = (workspace?.bookings ?? []).filter((booking) => {
		if (selectedFilter?.value === 'missing' && booking.current_package_id !== null) return false;
		if (selectedFilter?.value === 'linked' && booking.current_package_id === null) return false;
		// Filter by selected target package ONLY for "selected" option
		if (
			selectedFilter?.value === 'selected' &&
			selectedTargetPackageId &&
			String(booking.current_package_id ?? '') !== selectedTargetPackageId
		)
			return false;
		if (selectedClientFilter && String(booking.client_id) !== selectedClientFilter) return false;
		if (dateFrom && (!booking.booking_date || booking.booking_date < dateFrom)) return false;
		if (dateTo && (!booking.booking_date || booking.booking_date > dateTo)) return false;
		if (search.trim()) {
			const haystack = [
				String(booking.id),
				booking.client_name,
				booking.trainer_name,
				booking.location_name,
				booking.current_package_label,
				booking.status
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();
			if (!haystack.includes(search.trim().toLowerCase())) return false;
		}
		return true;
	});
	$: visibleBookings = filteredBookings.slice(0, visibleCount);
	$: hasMoreBookings = visibleCount < filteredBookings.length;
	$: selectedVisibleIds = visibleSelectionIds();
	$: allVisibleSelected =
		selectedVisibleIds.length > 0 &&
		selectedVisibleIds.every((id) => selectedBookingIds.includes(id));

	function handleTableScroll(event: Event) {
		const target = event.target as HTMLElement;
		const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
		if (bottom && hasMoreBookings) {
			visibleCount += 50;
		}
	}

	// Reset visible count when filters change
	$: if (
		selectedFilter ||
		search ||
		dateFrom ||
		dateTo ||
		selectedClientFilter ||
		selectedTargetPackageId
	) {
		visibleCount = 50;
	}
</script>

<div class="flex flex-col gap-4 overflow-auto">
	<div class="grid gap-3 lg:grid-cols-[2fr_1fr]">
		<div class="rounded-sm border border-gray-200 bg-gray-50 p-4">
			<div class="mb-2 flex items-center gap-2">
				<Icon icon="Package" size="18px" />
				<h3 class="text-lg font-semibold text-gray-900">
					{scope === 'client' ? 'Klient' : 'Kund'}: {workspace?.subject?.name ?? 'Laddar...'}
				</h3>
			</div>
			<p class="text-sm text-gray-600">
				Hantera bokningar utan paket, flytta bokningar mellan paket och koppla bort felaktiga
				paketkopplingar.
			</p>
		</div>

		<div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
			<div class="rounded-sm border border-gray-200 bg-white p-4">
				<p class="text-xs font-semibold tracking-wide text-gray-500 uppercase">Bokningar</p>
				<p class="mt-1 text-2xl font-semibold text-gray-900">{workspace?.summary.all ?? 0}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4">
				<p class="text-xs font-semibold tracking-wide text-gray-500 uppercase">Har paket</p>
				<p class="mt-1 text-2xl font-semibold text-gray-900">{workspace?.summary.linked ?? 0}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4">
				<p class="text-xs font-semibold tracking-wide text-gray-500 uppercase">Saknar paket</p>
				<p class="mt-1 text-2xl font-semibold text-gray-900">{workspace?.summary.missing ?? 0}</p>
			</div>
		</div>
	</div>

	<div class="rounded-sm border border-gray-200 bg-white">
		<button type="button" class="collapsible-header" on:click={() => (showFilters = !showFilters)}>
			<div class="flex items-center gap-2">
				<Icon icon={showFilters ? 'ChevronDown' : 'ChevronRight'} size="16px" />
				<span class="font-semibold text-gray-900">Filter</span>
			</div>
		</button>
		{#if showFilters}
			<div class="collapsible-content">
				<div class="filter-row">
					<div class="filter-item">
						<Input
							name="search"
							type="search"
							placeholder="Sök bokning, klient, tränare, paket"
							bind:value={search}
						/>
					</div>
					<div class="filter-item">
						<Dropdown
							id="package-filter"
							label=""
							noLabel
							placeholder="Alla nuvarande paket"
							options={packageDropdownOptions}
							bind:selectedValue={selectedPackageFilter}
						/>
					</div>
					<div class="filter-item">
						<DatePicker id="date-from" label="" placeholder="Från datum" bind:value={dateFrom} />
					</div>
					<div class="filter-item">
						<DatePicker id="date-to" label="" placeholder="Till datum" bind:value={dateTo} />
					</div>
					{#if scope === 'customer'}
						<div class="filter-item">
							<Dropdown
								id="client-filter"
								label=""
								noLabel
								placeholder="Alla klienter"
								options={clientDropdownOptions}
								bind:selectedValue={selectedClientFilter}
							/>
						</div>
					{/if}
					<div class="filter-item filter-item-button">
						<Button
							text="Rensa"
							variant="secondary"
							small
							on:click={() => {
								search = '';
								dateFrom = '';
								dateTo = '';
								selectedPackageFilter = '';
								selectedClientFilter = '';
								selectedFilter =
									filterOptionsWithCounts.find((option) => option.value === initialFilter) ??
									filterOptionsWithCounts[0];
							}}
						/>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<div class="rounded-sm border border-gray-200 bg-white">
		<button
			type="button"
			class="collapsible-header"
			on:click={() => (showPackages = !showPackages)}
		>
			<div class="flex items-center gap-2">
				<Icon icon={showPackages ? 'ChevronDown' : 'ChevronRight'} size="16px" />
				<span class="font-semibold text-gray-900">Paket</span>
				{#if selectedPackage}
					<span class="bg-orange/10 text-orange ml-2 rounded-sm px-2 py-0.5 text-xs">
						{selectedPackage.article_name} (saldo: {formatSaldo(
							selectedPackage.remaining_sessions
						)})
					</span>
				{/if}
			</div>
			<span class="text-sm text-gray-500">{packageOptions.length} paket</span>
		</button>
		{#if showPackages}
			<div class="collapsible-content">
				<p class="mb-3 text-sm text-gray-600">
					Välj paket för att visa dess bokningar och lägga till nya.
				</p>
				<div class="package-grid">
					{#each sortedPackageOptions as pkg (pkg.id)}
						<button
							type="button"
							class:selected={String(pkg.id) === selectedTargetPackageId}
							class="package-card"
							on:click={() => {
								selectedTargetPackageId = String(pkg.id);
								selectedPackageFilter = String(pkg.id);
								selectedFilter =
									filterOptionsWithCounts.find((opt) => opt.value === 'selected') ??
									filterOptionsWithCounts[0];
							}}
						>
							<div class="flex items-start justify-between gap-3">
								<div>
									<p class="text-sm font-semibold text-gray-900">{pkg.article_name}</p>
									<p class="mt-1 text-xs text-gray-500">{packageMeta(pkg)}</p>
								</div>
								<span class="rounded-sm bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
									>#{pkg.id}</span
								>
							</div>
							<div class="mt-3 flex items-center justify-between text-sm">
								<span class="text-gray-600">Saldo</span>
								<strong
									class:selected-saldo={pkg.remaining_sessions !== null &&
										pkg.remaining_sessions < 0}
									class="text-gray-900">{formatSaldo(pkg.remaining_sessions)}</strong
								>
							</div>
							<div class="mt-1 flex items-center justify-between text-sm text-gray-600">
								<span>Bokningar</span>
								<span>{pkg.used_sessions_total}/{pkg.total_sessions ?? '—'}</span>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<div class="rounded-sm border border-gray-200 bg-white">
		<button type="button" class="collapsible-header" on:click={() => (showActions = !showActions)}>
			<div class="flex items-center gap-2">
				<Icon icon={showActions ? 'ChevronDown' : 'ChevronRight'} size="16px" />
				<span class="font-semibold text-gray-900">Åtgärder</span>
				{#if allSelectedBookings.length > 0}
					<span class="bg-orange ml-2 rounded-full px-2 py-0.5 text-xs text-white">
						{allSelectedBookings.length} valda
					</span>
				{/if}
			</div>
		</button>
		{#if showActions}
			<div class="collapsible-content">
				<div class="mb-4 space-y-3">
					<div>
						<p class="mb-2 text-sm font-medium text-gray-700">Lägg till bokningar på valt paket</p>
						<Button
							text="Lägg till på valt paket"
							variant="primary"
							small
							disabled={submitting || !selectedTargetPackageId || isSelectedPackageFull}
							on:click={() => runAction('assign')}
						/>
						{#if isSelectedPackageFull}
							<span class="ml-2 text-xs text-red-600">Paketet är fullt</span>
						{:else if !selectedTargetPackageId}
							<span class="ml-2 text-xs text-gray-500">Välj ett paket först</span>
						{/if}
					</div>
					<div>
						<p class="mb-2 text-sm font-medium text-gray-700">Flytta bokningar till annat paket</p>
						<div class="flex flex-wrap items-center gap-2">
							<div class="w-64">
								<Dropdown
									id="move-destination"
									label=""
									noLabel
									placeholder="Välj destinationspaket"
									options={moveDestinationOptions}
									bind:selectedValue={moveDestinationPackageId}
								/>
							</div>
							<Button
								text="Flytta till valt paket"
								variant="secondary"
								small
								disabled={submitting || !moveDestinationPackageId}
								on:click={() => runAction('move')}
							/>
						</div>
					</div>
					{#if selectedFilter?.value !== 'missing'}
						<div>
							<p class="mb-2 text-sm font-medium text-gray-700">Ta bort bokningar från paket</p>
							<Button
								text="Ta bort från paket"
								variant="danger-outline"
								small
								disabled={submitting}
								on:click={() => runAction('remove')}
							/>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	{#if successMessage}
		<div class="rounded-sm border border-green-300 bg-green-50 p-3 text-green-900">
			{successMessage}
		</div>
	{/if}
	{#if error}
		<div class="rounded-sm border border-red-300 bg-red-50 p-3 text-red-800">{error}</div>
	{/if}
	{#if validationRows.length > 0}
		<div class="rounded-sm border border-yellow-300 bg-yellow-50 p-3 text-yellow-900">
			<p class="font-semibold">Följande bokningar kunde inte uppdateras:</p>
			<ul class="mt-2 list-disc pl-5 text-sm">
				{#each validationRows as row (row.bookingId)}
					<li>Bokning #{row.bookingId}: {row.reason}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div
		class="flex items-center justify-between rounded-sm border border-gray-200 bg-white px-4 py-3"
	>
		<OptionButton
			options={filterOptionsWithCounts}
			bind:selectedOption={selectedFilter}
			size="small"
		/>
	</div>

	<div class="rounded-sm border border-gray-200 bg-white">
		{#if loading}
			<div class="flex items-center justify-center p-8 text-gray-600">Laddar bokningar…</div>
		{:else if !workspace}
			<div class="flex items-center justify-center p-8 text-gray-600">Ingen data att visa.</div>
		{:else if filteredBookings.length === 0}
			<div class="flex items-center justify-center p-8 text-gray-600">
				Inga bokningar matchar filtren.
			</div>
		{:else}
			<div
				class="max-h-[50vh] overflow-auto"
				bind:this={tableContainer}
				on:scroll={handleTableScroll}
			>
				<table class="min-w-full table-auto border-collapse text-sm">
					<thead class="bg-gray sticky top-0 z-10 text-left text-white">
						<tr>
							<th class="p-3">
								<input type="checkbox" checked={allVisibleSelected} on:change={toggleAllVisible} />
							</th>
							<th class="p-3">Start</th>
							<th class="p-3">Klient</th>
							<th class="p-3">Tränare</th>
							<th class="p-3">Status</th>
							<th class="p-3">Nuvarande paket</th>
							<th class="p-3">Markering</th>
							<th class="p-3">Tillagd</th>
							<th class="p-3">Åtgärd</th>
						</tr>
					</thead>
					<tbody>
						{#each visibleBookings as booking (booking.id)}
							<tr class="border-b border-gray-200 align-top hover:bg-gray-50">
								<td class="p-3">
									<input
										type="checkbox"
										checked={selectedBookingIds.includes(booking.id)}
										on:change={() => toggleBooking(booking.id)}
									/>
								</td>
								<td class="p-3 text-gray-800">{formatDateTime(booking.start_time)}</td>
								<td class="p-3 text-gray-800">
									<div>{booking.client_name}</div>
									<div class="text-xs text-gray-500">#{booking.client_id}</div>
								</td>
								<td class="p-3 text-gray-700">{booking.trainer_name ?? '—'}</td>
								<td class="p-3 text-gray-700">{booking.status ?? '—'}</td>
								<td class="p-3 text-gray-700">
									<div>{booking.current_package_label ?? 'Saknar paket'}</div>
									{#if booking.location_name}
										<div class="text-xs text-gray-500">{booking.location_name}</div>
									{/if}
								</td>
								<td class="p-3 text-gray-700">
									{#if booking.internal_education}
										<span class="rounded-sm bg-gray-100 px-2 py-1 text-xs text-gray-700"
											>Praktik</span
										>
									{:else}
										—
									{/if}
								</td>
								<td class="p-3 text-gray-700">{formatDateTime(booking.added_to_package_date)}</td>
								<td class="p-3">
									{#if booking.current_package_id !== null}
										<Button
											text="Ta bort"
											variant="danger-outline"
											small
											on:click={() => removeSingle(booking.id)}
										/>
									{:else}
										<span class="text-xs text-gray-500">Välj paket ovan</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#if hasMoreBookings}
					<div class="py-4 text-center text-sm text-gray-500">Laddar fler...</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.package-grid {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	}

	.package-card {
		border: 1px solid rgb(229 231 235);
		border-radius: 0.125rem;
		background: white;
		padding: 0.9rem;
		text-align: left;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease,
			transform 0.15s ease;
	}

	.package-card:hover {
		border-color: rgb(249 115 22);
		box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
	}

	.package-card.selected {
		border-color: rgb(249 115 22);
		box-shadow: 0 0 0 1px rgb(249 115 22);
	}

	.selected-saldo {
		color: rgb(185 28 28);
	}

	.collapsible-header {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.15s ease;
	}

	.collapsible-header:hover {
		background-color: rgb(249 250 251);
	}

	.collapsible-content {
		padding: 0 1rem 1rem 1rem;
		border-top: 1px solid rgb(229 231 235);
		padding-top: 1rem;
	}

	.filter-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: flex-end;
	}

	.filter-item {
		flex: 1 1 180px;
		min-width: 0;
		max-width: 220px;
	}

	.filter-item :global(.mb-4) {
		margin-bottom: 0;
	}

	.filter-item-button {
		flex: 0 0 auto;
		max-width: none;
	}
</style>
