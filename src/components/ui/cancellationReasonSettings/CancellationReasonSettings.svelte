<script lang="ts">
	import { onMount } from 'svelte';
	import Input from '../../bits/Input/Input.svelte';
	import Checkbox from '../../bits/checkbox/Checkbox.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import { user as userStore } from '$lib/stores/userStore';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import type { CancellationReason } from '$lib/types/cancellationReason';
	import {
		createCancellationReason,
		deleteCancellationReason,
		fetchAdminCancellationReasons,
		updateCancellationReason
	} from '$lib/services/api/cancellationReasonService';
	import {
		fetchAllCancellationReasons,
		fetchCancellationReasons
	} from '$lib/stores/cancellationReasonStore';

	let isAdmin = false;
	let reasons: CancellationReason[] = [];
	let isLoading = false;
	let loadError: string | null = null;

	let formErrors: Record<string, string> = {};
	let label = '';
	let active = true;
	let draftLabels: Record<number, string> = {};
	let rowErrors: Record<number, string> = {};
	let savingIds: Record<number, boolean> = {};

	onMount(() => {
		const unsubscribe = userStore.subscribe((currentUser) => {
			const admin = hasRole('Administrator', currentUser as any);
			if (admin !== isAdmin) {
				isAdmin = admin;
				if (isAdmin) {
					loadReasons();
				} else {
					reasons = [];
					draftLabels = {};
				}
			} else if (admin && !reasons.length && !isLoading) {
				loadReasons();
			}
		});

		return () => unsubscribe();
	});

	function syncDrafts(items: CancellationReason[]) {
		draftLabels = Object.fromEntries(items.map((item) => [item.id, item.label]));
	}

	function sortReasons(items: CancellationReason[]) {
		return [...items].sort((a, b) => {
			if (a.active !== b.active) return a.active ? -1 : 1;
			return a.label.localeCompare(b.label, 'sv-SE', { sensitivity: 'base', numeric: true });
		});
	}

	async function refreshPublicReasons() {
		try {
			await Promise.all([fetchCancellationReasons(), fetchAllCancellationReasons()]);
		} catch {
			// The store helper already logs fetch failures.
		}
	}

	async function loadReasons() {
		if (!isAdmin) return;
		isLoading = true;
		loadError = null;
		try {
			reasons = await fetchAdminCancellationReasons();
			syncDrafts(reasons);
		} catch (error) {
			console.error('Failed to load cancellation reasons', error);
			loadError = 'Kunde inte hämta avbokningsorsaker just nu.';
			reasons = [];
			draftLabels = {};
		} finally {
			isLoading = false;
		}
	}

	function resetForm() {
		label = '';
		active = true;
		formErrors = {};
	}

	function setSaving(id: number, value: boolean) {
		savingIds = { ...savingIds, [id]: value };
	}

	function setRowError(id: number, value = '') {
		rowErrors = { ...rowErrors, [id]: value };
	}

	function upsertReason(updated: CancellationReason) {
		reasons = sortReasons(reasons.map((item) => (item.id === updated.id ? updated : item)));
		draftLabels = { ...draftLabels, [updated.id]: updated.label };
	}

	async function handleCreate() {
		if (!isAdmin || isLoading) return;
		formErrors = {};
		const trimmedLabel = label.trim();
		if (!trimmedLabel) {
			formErrors = { label: 'Orsak krävs' };
			return;
		}

		try {
			const created = await createCancellationReason({
				label: trimmedLabel,
				active
			});
			reasons = sortReasons([created, ...reasons]);
			syncDrafts(reasons);
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Avbokningsorsak sparad',
				description: 'Den nya orsaken har lagts till.'
			});
			resetForm();
			await refreshPublicReasons();
		} catch (error) {
			console.error('Failed to create cancellation reason', error);
			const err = error as { errors?: Record<string, string> };
			if (err?.errors) {
				formErrors = err.errors;
			}
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte spara',
				description: 'Försök igen senare.'
			});
		}
	}

	async function handleSave(reason: CancellationReason) {
		const id = reason.id;
		const trimmedLabel = (draftLabels[id] ?? '').trim();
		if (!trimmedLabel) {
			setRowError(id, 'Orsak krävs');
			return;
		}

		setSaving(id, true);
		setRowError(id);
		try {
			const updated = await updateCancellationReason(id, {
				label: trimmedLabel,
				active: reason.active
			});
			upsertReason(updated);
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Avbokningsorsak uppdaterad',
				description: 'Ändringarna har sparats.'
			});
			await refreshPublicReasons();
		} catch (error) {
			console.error('Failed to update cancellation reason', error);
			const err = error as { errors?: Record<string, string> };
			if (err?.errors?.label) {
				setRowError(id, err.errors.label);
			}
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte uppdatera',
				description: 'Försök igen senare.'
			});
		} finally {
			setSaving(id, false);
		}
	}

	async function handleToggleActive(reason: CancellationReason) {
		const id = reason.id;
		setSaving(id, true);
		try {
			const updated = await updateCancellationReason(id, {
				label: draftLabels[id] ?? reason.label,
				active: !reason.active
			});
			upsertReason(updated);
			await refreshPublicReasons();
		} catch (error) {
			console.error('Failed to toggle cancellation reason', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ändra status',
				description: 'Försök igen senare.'
			});
		} finally {
			setSaving(id, false);
		}
	}

	async function handleDelete(reason: CancellationReason) {
		const id = reason.id;
		try {
			const result = await deleteCancellationReason(id);
			if (result.deleted) {
				reasons = reasons.filter((item) => item.id !== id);
				const { [id]: _removedLabel, ...remainingLabels } = draftLabels;
				const { [id]: _removedError, ...remainingErrors } = rowErrors;
				draftLabels = remainingLabels;
				rowErrors = remainingErrors;
				addToast({
					type: AppToastType.SUCCESS,
					message: 'Avbokningsorsak borttagen',
					description: 'Den valda orsaken är borttagen.'
				});
			} else if (result.deactivated && result.data && 'label' in result.data) {
				upsertReason(result.data as CancellationReason);
				addToast({
					type: AppToastType.SUCCESS,
					message: 'Avbokningsorsak inaktiverad',
					description: 'Den används i historiska bokningar och togs därför bort från nya val.'
				});
			}
			await refreshPublicReasons();
		} catch (error) {
			console.error('Failed to delete cancellation reason', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ta bort',
				description: 'Försök igen senare.'
			});
		}
	}

	function deleteDescription(reason: CancellationReason) {
		const count = reason.bookingsCount ?? 0;
		if (count > 0) {
			return `"${reason.label}" används i ${count} bokningar och kommer därför att inaktiveras.`;
		}
		return `Ta bort "${reason.label}"?`;
	}
</script>

{#if !isAdmin}
	<div class="border-gray/60 rounded border bg-white/40 p-4 text-gray-700">
		Du behöver administratörsbehörighet för att hantera avbokningsorsaker.
	</div>
{:else}
	<div class="space-y-6">
		<section class="border-gray/60 rounded border bg-white/40 p-4 shadow-sm">
			<div class="mb-4">
				<h3 class="text-text text-lg font-semibold">Lägg till avbokningsorsak</h3>
				<p class="text-sm text-gray-600">Aktiva orsaker visas när bokningar avbokas.</p>
			</div>

			<div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
				<Input
					label="Orsak"
					name="label"
					bind:value={label}
					placeholder="Ex. Flyttat träningen"
					errors={formErrors}
				/>
				<div class="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:gap-4">
					<Checkbox id="cancellation-reason-active" label="Aktiv" name="active" bind:checked={active} />
					<Button text="Spara orsak" iconLeft="Plus" small on:click={handleCreate} />
				</div>
			</div>
		</section>

		<section class="border-gray/60 rounded border bg-white/40 p-4 shadow-sm">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-text text-lg font-semibold">Befintliga avbokningsorsaker</h3>
				{#if isLoading}
					<span class="text-sm text-gray-600">Hämtar...</span>
				{:else if loadError}
					<span class="text-sm text-red-600">{loadError}</span>
				{/if}
			</div>

			{#if reasons.length === 0 && !isLoading}
				<p class="text-sm text-gray-600">Inga avbokningsorsaker tillagda ännu.</p>
			{:else}
				<div class="divide-gray/40 border-gray/40 divide-y rounded border bg-white/30">
					{#each reasons as reason}
						{@const id = reason.id}
						<div class="flex flex-col gap-3 p-3 md:flex-row md:items-start md:justify-between">
							<div class="min-w-0 flex-1">
								<Input
									label="Orsak"
									name={`cancellation-reason-${id}`}
									bind:value={draftLabels[id]}
									errors={rowErrors[id] ? { [`cancellation-reason-${id}`]: rowErrors[id] } : {}}
								/>

								<div class="flex flex-wrap items-center gap-2 text-xs text-gray-600">
									<span>Status: {reason.active ? 'Aktiv' : 'Inaktiv'}</span>
									<span>·</span>
									<span>{reason.bookingsCount ?? 0} bokningar</span>
									{#if reason.createdAt}
										<span>· Skapad {new Date(reason.createdAt).toLocaleDateString('sv-SE')}</span>
									{/if}
								</div>
							</div>

							<div class="flex shrink-0 flex-wrap items-center gap-3 md:pt-8">
								<Checkbox
									id={`cancellation-reason-active-${id}`}
									name={`cancellation-reason-active-${id}`}
									label="Aktiv"
									checked={Boolean(reason.active)}
									on:change={() => handleToggleActive(reason)}
								/>
								<Button
									text={savingIds[id] ? 'Sparar...' : 'Spara'}
									iconLeft="Save"
									variant="secondary"
									small
									disabled={Boolean(savingIds[id])}
									on:click={() => handleSave(reason)}
								/>
								<Button
									text={reason.bookingsCount ? 'Inaktivera' : 'Ta bort'}
									iconLeft="Trash"
									variant="danger-outline"
									small
									confirmOptions={{
										title: reason.bookingsCount
											? 'Inaktivera avbokningsorsak'
											: 'Ta bort avbokningsorsak',
										description: deleteDescription(reason),
										actionLabel: reason.bookingsCount ? 'Inaktivera' : 'Ta bort',
										action: () => handleDelete(reason)
									}}
								/>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
{/if}
