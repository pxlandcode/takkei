<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import Button from '../bits/button/Button.svelte';
	import Dropdown from '../bits/dropdown/Dropdown.svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import { invalidateByPrefix } from '$lib/services/api/apiCache';
	import { goto } from '$app/navigation';

	type EntityType = 'client' | 'customer';
	type Impact = {
		action: 'hard_delete' | 'anonymize';
		canHardDelete: boolean;
		retainedRecordCount: number;
		counts: Record<string, number>;
		gdprDeletedAt?: string | null;
	};
	type CountEntry = {
		key: string;
		label: string;
		value: number;
	};
	type CountGroup = {
		key: string;
		title: string;
		entries: CountEntry[];
	};
	type MergeFieldPlanEntry = {
		key: string;
		label: string;
		sourceValue: string | null;
		targetValue: string | null;
		keptValue: string | null;
		keptFrom: 'target' | 'source' | 'empty';
		differs: boolean;
	};
	type MergePreview = {
		source: { id: number; name: string; gdprDeletedAt?: string | null };
		target: { id: number; name: string; gdprDeletedAt?: string | null };
		fieldPlan: MergeFieldPlanEntry[];
		impact: Impact;
	};
	type CompletedAction = {
		kind: 'hard_deleted' | 'anonymized' | 'merged';
		title: string;
		description: string;
		actionLabel?: string;
		actionUrl?: string;
	};

	export let entity: EntityType;
	export let entityId: number;
	export let displayName = '';
	export let isDeleted = false;
	export let onDeleted: ((event: CustomEvent<any>) => void) | null = null;
	export let onMerged: ((event: CustomEvent<any>) => void) | null = null;

	const dispatch = createEventDispatcher<{
		deleted: any;
		merged: any;
	}>();

	let impact: Impact | null = null;
	let mergePreview: MergePreview | null = null;
	let targetOptions: { label: string; value: number }[] = [];
	let selectedTargetId: number | '' = '';
	let loadingImpact = false;
	let loadingTargets = false;
	let loadingMergePreview = false;
	let deleting = false;
	let merging = false;
	let error = '';
	let mergeError = '';
	let impactCountGroups: CountGroup[] = [];
	let mergeCountEntries: CountEntry[] = [];
	let completedAction: CompletedAction | null = null;
	let lastEntityKey = '';

	$: entityLabel = entity === 'client' ? 'klient' : 'kund';
	$: entityLabelTitle = entity === 'client' ? 'Klient' : 'Kund';
	$: endpointBase = entity === 'client' ? '/api/clients' : '/api/customers';
	$: targetIdField = entity === 'client' ? 'targetClientId' : 'targetCustomerId';
	$: targetOptionLabel = entity === 'client' ? 'Välj målklient' : 'Välj målkund';
	$: targetEntityLabel = entity === 'client' ? 'målklienten' : 'målkunden';
	$: selectedTargetLabel =
		targetOptions.find((option) => Number(option.value) === Number(selectedTargetId))?.label ?? '';
	$: {
		const entityKey = `${entity}:${entityId}`;
		if (entityKey !== lastEntityKey) {
			lastEntityKey = entityKey;
			completedAction = null;
			impact = null;
			mergePreview = null;
			selectedTargetId = '';
		}
	}

	const countLabels: Record<string, string> = {
		bookings: 'bokningar',
		packages: 'paket',
		memberships: 'medlemskap',
		invoiceReminders: 'fakturapåminnelser',
		customerRelationships: 'kundkopplingar',
		clientRelationships: 'klientkopplingar',
		legacyClients: 'äldre kundkopplingar',
		notes: 'anteckningar',
		standbyTimes: 'standbytider',
		authUsers: 'klientinloggningar'
	};

	function getCountEntries(counts: Record<string, number> | null | undefined): CountEntry[] {
		if (!counts) return [];
		return Object.entries(counts)
			.filter(([, value]) => Number(value) > 0)
			.map(([key, value]) => ({
				key,
				label: countLabels[key] ?? key,
				value: Number(value)
			}));
	}

	function getCountEntriesForKeys(
		counts: Record<string, number> | null | undefined,
		keys: string[]
	): CountEntry[] {
		if (!counts) return [];
		return keys
			.map((key) => ({
				key,
				label: countLabels[key] ?? key,
				value: Number(counts[key] ?? 0)
			}))
			.filter((entry) => entry.value > 0);
	}

	function getImpactCountGroups(impact: Impact | null): CountGroup[] {
		if (!impact) return [];
		if (impact.canHardDelete) {
			const entries = getCountEntries(impact.counts);
			return entries.length ? [{ key: 'hard-delete', title: 'Raderas helt', entries }] : [];
		}

		const retainedKeys =
			entity === 'client'
				? ['bookings', 'packages', 'memberships', 'invoiceReminders']
				: ['packages', 'memberships'];
		const deletedKeys =
			entity === 'client' ? ['notes', 'standbyTimes', 'authUsers'] : ['notes'];
		const inactiveKeys =
			entity === 'client' ? ['customerRelationships'] : ['clientRelationships'];
		const disconnectedKeys = entity === 'customer' ? ['legacyClients'] : [];

		return [
			{
				key: 'retained',
				title: 'Behålls med anonymiserad profil',
				entries: getCountEntriesForKeys(impact.counts, retainedKeys)
			},
			{
				key: 'deleted',
				title: 'Raderas',
				entries: getCountEntriesForKeys(impact.counts, deletedKeys)
			},
			{
				key: 'inactive',
				title: 'Inaktiveras',
				entries: getCountEntriesForKeys(impact.counts, inactiveKeys)
			},
			{
				key: 'disconnected',
				title: 'Kopplas bort',
				entries: getCountEntriesForKeys(impact.counts, disconnectedKeys)
			}
		].filter((group) => group.entries.length);
	}

	$: impactCountGroups = getImpactCountGroups(impact);
	$: mergeCountEntries = getCountEntries(mergePreview?.impact?.counts);

	$: deleteDescription = impact
		? impact.canHardDelete
			? `${entityLabelTitle}en saknar historik som behöver behållas och tas bort helt.`
			: `${entityLabelTitle}en har historik som behöver behållas. Profilens personuppgifter anonymiseras och vissa sidoposter raderas eller kopplas bort.`
		: `Hämtar information om vad som påverkas innan ${entityLabel}en tas bort.`;
	$: deleteConfirmDescription = impact
		? `Detta går inte att ångra. ${deleteDescription}`
		: `Detta går inte att ångra. Vänta tills berörda poster har hämtats innan du fortsätter.`;

	$: mergeDescription = selectedTargetLabel
		? `Den här profilen slås ihop in i ${selectedTargetLabel}. ${selectedTargetLabel} behålls som profil. Målprofilens information vinner; tomma fält i målprofilen fylls från den här profilen.`
		: `Välj ${targetEntityLabel} som ska behållas. Den här profilen flyttas in i den valda profilen.`;
	$: mergeConfirmDescription = `Detta går inte att ångra. ${mergeDescription}`;

	function formatMergeValue(value: string | null | undefined) {
		return value?.trim() ? value : 'Saknas';
	}

	function mergeFieldExplanation(field: MergeFieldPlanEntry) {
		if (field.keptFrom === 'source') {
			return 'Målprofilen saknar värde. Fylls från den här profilen.';
		}
		if (field.keptFrom === 'empty') {
			return 'Saknas på båda profilerna.';
		}
		if (!field.differs) {
			return 'Samma värde på båda profilerna.';
		}
		return `Behålls från målprofilen. Den här profilen har: ${formatMergeValue(field.sourceValue)}.`;
	}

	function listUrl() {
		return entity === 'client' ? '/clients' : '/settings';
	}

	function profileUrl(id: number) {
		return entity === 'client' ? `/clients/${id}` : `/settings/customers/${id}`;
	}

	async function loadImpact() {
		if (!entityId || isDeleted) return;
		loadingImpact = true;
		error = '';
		try {
			const res = await fetch(`${endpointBase}/${entityId}/delete-impact`);
			const payload = await res.json();
			if (!res.ok) throw new Error(payload?.error || 'Kunde inte hämta påverkan');
			impact = payload;
		} catch (err: any) {
			error = err?.message ?? 'Kunde inte hämta påverkan';
		} finally {
			loadingImpact = false;
		}
	}

	async function loadTargets() {
		if (!entityId || isDeleted) return;
		loadingTargets = true;
		mergeError = '';
		try {
			const res = await fetch(`${endpointBase}?short=true&limit=5000`);
			const payload = await res.json();
			if (!res.ok || !Array.isArray(payload)) throw new Error('Kunde inte hämta profiler');
			targetOptions = payload
				.map((item: any) => {
					if (entity === 'client') {
						return {
							value: Number(item.id),
							label:
								[item.firstname, item.lastname].filter(Boolean).join(' ').trim() ||
								`Klient ${item.id}`
						};
					}
					return {
						value: Number(item.id),
						label: item.name || `Kund ${item.id}`
					};
				})
				.filter((item: { value: number }) => Number.isFinite(item.value) && item.value !== entityId);
		} catch (err: any) {
			mergeError = err?.message ?? 'Kunde inte hämta profiler';
		} finally {
			loadingTargets = false;
		}
	}

	async function loadMergePreview() {
		if (!selectedTargetId || isDeleted) {
			mergePreview = null;
			return;
		}
		const requestedTargetId = selectedTargetId;
		loadingMergePreview = true;
		mergePreview = null;
		mergeError = '';
		try {
			const qs = new URLSearchParams({ [targetIdField]: String(selectedTargetId) });
			const res = await fetch(`${endpointBase}/${entityId}/merge?${qs.toString()}`);
			const payload = await res.json();
			if (!res.ok) throw new Error(payload?.error || 'Kunde inte hämta sammanslagning');
			if (String(selectedTargetId) === String(requestedTargetId)) {
				mergePreview = payload;
			}
		} catch (err: any) {
			mergePreview = null;
			mergeError = err?.message ?? 'Kunde inte hämta sammanslagning';
		} finally {
			if (String(selectedTargetId) === String(requestedTargetId)) {
				loadingMergePreview = false;
			}
		}
	}

	async function handleDelete() {
		if (!entityId || deleting || isDeleted) return;
		deleting = true;
		error = '';
		try {
			const res = await fetch(`${endpointBase}/${entityId}`, { method: 'DELETE' });
			const payload = await res.json();
			if (!res.ok) throw new Error(payload?.error || `Kunde inte ta bort ${entityLabel}en`);
			const hardDeleted = Boolean(payload.hardDeleted || payload.action === 'hard_deleted');
			completedAction = hardDeleted
				? {
						kind: 'hard_deleted',
						title: `${entityLabelTitle}en är borttagen`,
						description:
							'Profilen togs bort helt eftersom det inte fanns historik som behövde behållas.',
						actionLabel: 'Gå till listan',
						actionUrl: listUrl()
					}
				: {
						kind: 'anonymized',
						title: `${entityLabelTitle}en är anonymiserad`,
						description:
							'Personuppgifterna är borttagna. Historik som behöver sparas ligger kvar på en raderad profil.'
					};
			addToast({
				type: AppToastType.SUCCESS,
				message: hardDeleted ? `${entityLabelTitle} borttagen` : `${entityLabelTitle} anonymiserad`,
				description: displayName || payload.id ? `${displayName || payload.id} är hanterad.` : ''
			});
			invalidateByPrefix(endpointBase);
			onDeleted?.(new CustomEvent('deleted', { detail: payload }));
			dispatch('deleted', payload);
		} catch (err: any) {
			error = err?.message ?? `Kunde inte ta bort ${entityLabel}en`;
			addToast({
				type: AppToastType.CANCEL,
				message: 'Åtgärden misslyckades',
				description: error
			});
		} finally {
			deleting = false;
		}
	}

	async function handleMerge() {
		if (!entityId || !selectedTargetId || !mergePreview || loadingMergePreview || merging || isDeleted) return;
		merging = true;
		mergeError = '';
		try {
			const res = await fetch(`${endpointBase}/${entityId}/merge`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ [targetIdField]: Number(selectedTargetId) })
			});
			const payload = await res.json();
			if (!res.ok) throw new Error(payload?.error || `Kunde inte slå ihop ${entityLabel}erna`);
			const targetId = Number(payload.targetId ?? selectedTargetId);
			const targetLabel =
				selectedTargetLabel ||
				(Number.isFinite(targetId) && targetId > 0 ? `${entityLabelTitle} #${targetId}` : 'målprofilen');
			completedAction = {
				kind: 'merged',
				title: `${entityLabelTitle}erna är ihopslagna`,
				description: `Den här profilen har flyttats till ${targetLabel}. Målprofilen är profilen som ska användas framåt.`,
				actionLabel: Number.isFinite(targetId) && targetId > 0 ? 'Gå till målprofil' : undefined,
				actionUrl: Number.isFinite(targetId) && targetId > 0 ? profileUrl(targetId) : undefined
			};
			addToast({
				type: AppToastType.SUCCESS,
				message: `${entityLabelTitle}er ihopslagna`,
				description: targetLabel ? `Profilen flyttades till ${targetLabel}.` : ''
			});
			invalidateByPrefix(endpointBase);
			onMerged?.(new CustomEvent('merged', { detail: payload }));
			dispatch('merged', payload);
		} catch (err: any) {
			mergeError = err?.message ?? `Kunde inte slå ihop ${entityLabel}erna`;
			addToast({
				type: AppToastType.CANCEL,
				message: 'Sammanslagning misslyckades',
				description: mergeError
			});
		} finally {
			merging = false;
		}
	}

	onMount(() => {
		loadImpact();
		loadTargets();
	});

	$: if (selectedTargetId) {
		void loadMergePreview();
	}
</script>

<div class="rounded-sm border border-red-200 bg-white p-6 shadow-md">
	<div class="mb-4 flex flex-col gap-1">
		<h4 class="text-xl font-semibold text-text">Hantering</h4>
		<p class="text-sm text-gray-500">Endast administratörer kan ta bort eller slå ihop profiler.</p>
	</div>

	{#if completedAction}
		<div class="rounded-sm border border-green-300 bg-green-50 p-4 text-green-950">
			<p class="font-semibold">{completedAction.title}</p>
			<p class="mt-1 text-sm">{completedAction.description}</p>
			{#if completedAction.actionUrl && completedAction.actionLabel}
				<div class="mt-3">
					<Button
						text={completedAction.actionLabel}
						iconLeft="GoTo"
						iconLeftSize="14px"
						variant="secondary"
						small
						on:click={() => completedAction?.actionUrl && goto(completedAction.actionUrl)}
					/>
				</div>
			{/if}
		</div>
	{:else if isDeleted}
		<div class="rounded-sm border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
			Profilen är redan GDPR-raderad.
		</div>
	{:else}
		<div class="flex flex-col gap-4">
			<div class="rounded-sm border border-gray-200 p-4">
				<div class="mb-3">
					<p class="font-semibold text-text">Ta bort {entityLabel}</p>
					<p class="mt-1 text-sm text-gray-600">
						{loadingImpact ? 'Hämtar påverkan...' : deleteDescription}
					</p>
				</div>
				{#if impact}
					<div class="mb-4">
						<p class="mb-2 text-base font-semibold text-text">Berörda poster</p>
						{#if impactCountGroups.length}
							<div class="flex flex-col gap-3">
								{#each impactCountGroups as group (group.key)}
									<div>
										<p class="mb-1 text-sm font-semibold text-gray-800">{group.title}</p>
										<div class="flex flex-col gap-1">
											{#each group.entries as entry (entry.key)}
												<div class="flex items-baseline gap-2 text-sm text-gray-700">
													<span class="min-w-5 text-base font-semibold text-text">{entry.value}</span>
													<span>{entry.label}</span>
												</div>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-gray-600">Inga berörda poster.</p>
						{/if}
					</div>
				{/if}
				{#if error}
					<p class="mb-3 text-sm text-error">{error}</p>
				{/if}
				<Button
					text={impact?.canHardDelete ? 'Ta bort helt' : 'Anonymisera'}
					iconLeft="Trash"
					iconLeftSize="14px"
					variant="danger-outline"
					small
					disabled={loadingImpact || deleting}
					confirmOptions={{
						title: `Ta bort ${entityLabel}?`,
						description: deleteConfirmDescription,
						actionLabel: impact?.canHardDelete ? 'Ta bort' : 'Anonymisera',
						action: handleDelete
					}}
				/>
			</div>

			<div class="rounded-sm border border-gray-200 p-4">
				<div class="mb-3">
					<p class="font-semibold text-text">Slå ihop dubblett</p>
					<p class="mt-1 text-sm text-gray-600">{mergeDescription}</p>
				</div>
				<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
					<div class="min-w-0 flex-1">
						<Dropdown
							id={`merge-target-${entity}-${entityId}`}
							label={targetOptionLabel}
							placeholder={loadingTargets ? 'Hämtar profiler...' : targetOptionLabel}
							options={targetOptions}
							bind:selectedValue={selectedTargetId}
							disabled={loadingTargets}
							search
							infiniteScroll
						/>
					</div>
					<Button
						text="Slå ihop"
						iconLeft="Swap"
						iconLeftSize="16px"
						variant="secondary"
						disabled={!selectedTargetId || !mergePreview || loadingMergePreview || merging}
						confirmOptions={{
							title: `Slå ihop ${entityLabel}er?`,
							description: mergeConfirmDescription,
							actionLabel: 'Slå ihop',
							action: handleMerge
						}}
					/>
				</div>
				{#if loadingMergePreview}
					<p class="mb-3 text-sm text-gray-500">Hämtar sammanslagningsförhandsvisning...</p>
				{/if}
				{#if mergePreview}
					<div class="mb-4">
						<p class="mb-1 text-base font-semibold text-text">Sammanslagningens riktning</p>
						<p class="text-sm text-gray-600">
							Den här profilen:
							<span class="font-medium text-text">
								{mergePreview.source.name} (#{mergePreview.source.id})
							</span>
						</p>
						<p class="text-sm text-gray-600">
							Målprofil som behålls:
							<span class="font-medium text-text">
								{mergePreview.target.name} (#{mergePreview.target.id})
							</span>
						</p>
					</div>

					<div class="mb-4">
						<p class="mb-2 text-base font-semibold text-text">Information som behålls</p>
						<div class="flex flex-col divide-y divide-gray-100">
							{#each mergePreview.fieldPlan as field (field.key)}
								<div class="py-2 first:pt-0 last:pb-0">
									<div class="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
										<span class="text-sm font-semibold text-text sm:w-40">{field.label}</span>
										<span class="text-sm text-gray-800">{formatMergeValue(field.keptValue)}</span>
									</div>
									<p class="mt-1 text-xs text-gray-500">{mergeFieldExplanation(field)}</p>
								</div>
							{/each}
						</div>
					</div>
				{/if}
				{#if mergePreview?.impact?.counts}
					<div class="mb-4">
						<p class="mb-2 text-base font-semibold text-text">Källprofilens berörda poster</p>
						{#if mergeCountEntries.length}
							<div class="flex flex-col gap-1.5">
								{#each mergeCountEntries as entry (entry.key)}
									<div class="flex items-baseline gap-2 text-sm text-gray-700">
										<span class="min-w-5 text-base font-semibold text-text">{entry.value}</span>
										<span>{entry.label}</span>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-gray-600">Inga berörda poster.</p>
						{/if}
					</div>
				{/if}
				{#if mergeError}
					<p class="mb-3 text-sm text-error">{mergeError}</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
