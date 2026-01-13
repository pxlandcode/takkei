<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Input from '../../bits/Input/Input.svelte';
	import Checkbox from '../../bits/checkbox/Checkbox.svelte';
	import DatePicker from '../../bits/datePicker/DatePicker.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { closePopup } from '$lib/stores/popupStore';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';

	type Article = {
		id: number;
		name: string;
		price: string;
		sessions: number | null;
		validity_start_date: string | null;
		validity_end_date: string | null;
		kind: string | null;
		active: boolean;
		packages_count: number;
		memberships_count: number;
	};

	export let mode: 'create' | 'edit' = 'create';
	export let article: Article | null = null;

	const dispatch = createEventDispatcher();

	let name = article?.name ?? '';
	function priceForInput(value: string | number | null | undefined) {
		if (value === null || value === undefined) return '';
		const raw = String(value).trim();
		return raw ? raw.replace('.', ',') : '';
	}

	let price = priceForInput(article?.price);
	const isLegacyMembership = article?.kind === 'Membership';
	let kind = article?.kind ?? 'Sessions';
	let sessions = article?.sessions != null ? String(article.sessions) : '';
	let validityStart = article?.validity_start_date ?? '';
	let validityEnd = article?.validity_end_date ?? '';
	let active = article?.active ?? true;
	let limitedTime = Boolean(article?.validity_start_date);

	let errors: Record<string, string> = {};
	let saving = false;
	let formError: string | null = null;

	$: if (!isLegacyMembership && kind !== 'Sessions') {
		kind = 'Sessions';
	}

	$: showSessions = kind === 'Sessions';


	function clearStartDate() {
		validityStart = '';
	}

	function clearEndDate() {
		validityEnd = '';
	}

	async function save() {
		errors = {};
		formError = null;

		const trimmedName = name.trim();
		if (!trimmedName) {
			errors = { name: 'Namn krävs' };
			return;
		}

		saving = true;
		try {
			const payload = {
				name: trimmedName,
				price: price.trim() ? price.replace(',', '.') : '0',
				kind,
				sessions: sessions.trim() ? sessions.trim() : null,
				validity_start_date: limitedTime && validityStart ? validityStart : null,
				validity_end_date: limitedTime && validityEnd ? validityEnd : null,
				active
			};

			const isEdit = mode === 'edit' && Boolean(article?.id);
			const endpoint = isEdit ? `/api/settings/articles/${article?.id}` : '/api/settings/articles';
			const method = isEdit ? 'PUT' : 'POST';

			const res = await fetch(endpoint, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!res.ok) {
				let message = 'Kunde inte spara artikeln.';
				try {
					const data = await res.json();
					if (data?.errors?.name) {
						errors = { name: data.errors.name };
						message = data.errors.name;
					} else if (data?.error) {
						message = data.error;
					}
				} catch {
					// ignore
				}
				throw new Error(message);
			}

			const saved = await res.json();
			if (isEdit) {
				addToast({
					type: AppToastType.SUCCESS,
					message: 'Dina ändringar sparades',
					description: trimmedName
				});
				dispatch('updated', { article: saved });
				closePopup();
			} else {
				addToast({
					type: AppToastType.SUCCESS,
					message: 'Artikeln skapades',
					description: trimmedName
				});
				dispatch('created', { article: saved });
				closePopup();
			}
		} catch (error: any) {
			console.error('Save failed', error);
			formError = error?.message ?? 'Något gick fel.';
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte spara',
				description: formError
			});
		} finally {
			saving = false;
		}
	}

	function cancel() {
		closePopup();
	}
</script>

<div class="space-y-4">
	{#if formError}
		<div class="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</div>
	{/if}

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<Input label="Namn" name="name" bind:value={name} {errors} />
		<Input
			label="Pris (SEK, Ex. moms)"
			name="price"
			bind:value={price}
			placeholder="Ex. moms"
		/>
	</div>

	<div class="flex flex-col gap-1">
		<label class="text-sm font-medium text-gray">Typ</label>
		<div class="rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-600">
			{#if isLegacyMembership}
				Medlemskap (legacy)
			{:else}
				Träningspaket
			{/if}
		</div>
	</div>

	{#if showSessions}
		<Input label="Antal pass" name="sessions" bind:value={sessions} />
	{/if}

	<Checkbox
		id="limited-time"
		label="Artikeln har begränsad giltighetstid"
		bind:checked={limitedTime}
	/>

	{#if limitedTime}
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div class="space-y-2">
				<DatePicker id="validity-start" label="Giltig från" bind:value={validityStart} />
				<button type="button" class="text-xs text-gray-500 underline" on:click={clearStartDate}>
					Rensa
				</button>
			</div>
			<div class="space-y-2">
				<DatePicker id="validity-end" label="Giltig till" bind:value={validityEnd} />
				<button type="button" class="text-xs text-gray-500 underline" on:click={clearEndDate}>
					Rensa
				</button>
			</div>
		</div>
	{/if}

	<Checkbox id="active" label="Aktiv" bind:checked={active} />

	<div class="flex justify-end gap-2 pt-2">
		<Button
			text={mode === 'edit' ? 'Spara' : 'Skapa artikel'}
			variant="primary"
			on:click={save}
			disabled={saving}
		/>
		<Button text="Avbryt" variant="secondary" on:click={cancel} disabled={saving} />
	</div>
</div>
