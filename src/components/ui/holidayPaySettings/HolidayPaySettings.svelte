<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { user as userStore } from '$lib/stores/userStore';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import type { HolidayPay } from '$lib/types/holidayPay';
	import { fetchHolidayPayAdmin, saveHolidayPay } from '$lib/services/api/holidayPayService';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';

	type EntryRow = HolidayPay & { amountInput: string };

	let isAdmin = false;
	let isLoading = false;
	let loadError: string | null = null;
	let entries: EntryRow[] = [];
	let hasFetched = false;
	let savingUserId: number | null = null;
	let rowErrors: Record<number, string> = {};

	onMount(() => {
		const unsubscribe = userStore.subscribe((currentUser) => {
			const admin = hasRole('Administrator', currentUser as any);
			if (admin !== isAdmin) {
				isAdmin = admin;
				if (isAdmin) {
					loadEntries();
				} else {
					entries = [];
					hasFetched = false;
				}
			} else if (admin && !hasFetched && !isLoading) {
				loadEntries();
			}
		});

		return () => unsubscribe();
	});

	function formatDate(value: string | null | undefined) {
		if (!value) return 'Ingen uppdatering ännu';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return value;
		return parsed.toLocaleDateString('sv-SE', {
			dateStyle: 'medium'
		});
	}

	async function loadEntries() {
		if (!isAdmin) return;
		isLoading = true;
		loadError = null;
		rowErrors = {};
		try {
			const fetched = await fetchHolidayPayAdmin();
			entries = fetched
				.map((row) => ({
					...row,
					amountInput:
						typeof row.amount === 'number'
							? row.amount.toFixed(2)
							: row.amount?.toString() ?? ''
				}))
				.sort((a, b) => {
					const nameA = `${a.firstname ?? ''} ${a.lastname ?? ''}`.trim().toLowerCase();
					const nameB = `${b.firstname ?? ''} ${b.lastname ?? ''}`.trim().toLowerCase();
					return nameA.localeCompare(nameB);
				});
			hasFetched = true;
		} catch (error) {
			console.error('Failed to load holiday pay', error);
			loadError = 'Kunde inte hämta semesterersättning just nu.';
			entries = [];
		} finally {
			isLoading = false;
		}
	}

	function parseAmountInput(value: string): number | null {
		const normalized = value.replace(',', '.').trim();
		if (normalized === '') return null;
		const parsed = Number.parseFloat(normalized);
		return Number.isFinite(parsed) ? parsed : null;
	}

	function updateAmountInput(userId: number, value: string) {
		entries = entries.map((entry) =>
			entry.userId === userId ? { ...entry, amountInput: value } : entry
		);
	}

	function isDirty(entry: EntryRow): boolean {
		const parsed = parseAmountInput(entry.amountInput);
		if (parsed === null || !Number.isFinite(parsed)) return false;
		return parsed !== entry.amount;
	}

	async function handleSave(entry: EntryRow) {
		if (!isAdmin || savingUserId) return;
		const amount = parseAmountInput(entry.amountInput);
		rowErrors = { ...rowErrors, [entry.userId]: '' };

		if (amount === null || !Number.isFinite(amount)) {
			rowErrors = { ...rowErrors, [entry.userId]: 'Ange ett giltigt belopp.' };
			return;
		}
		if (amount < 0) {
			rowErrors = { ...rowErrors, [entry.userId]: 'Belopp kan inte vara negativt.' };
			return;
		}

		savingUserId = entry.userId;
		try {
			const saved = await saveHolidayPay({
				userId: entry.userId,
				amount
			});
			entries = entries.map((row) =>
				row.userId === saved.userId
					? {
							...row,
							...saved,
							amountInput: saved.amount.toFixed(2)
						}
					: row
			);
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Sparad',
				description: 'Semesterersättningen har uppdaterats.'
			});
		} catch (error) {
			console.error('Failed to save holiday pay', error);
			const apiError = error as { errors?: Record<string, string>; message?: string };
			const message =
				apiError?.errors?.amount ??
				apiError?.errors?.userId ??
				apiError?.message ??
				'Kunde inte spara just nu.';
			rowErrors = { ...rowErrors, [entry.userId]: message };
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte spara',
				description: message
			});
		} finally {
			savingUserId = null;
		}
	}
</script>

<div class="rounded-md bg-white p-6 shadow-sm">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="flex items-center gap-3">
				<div class="bg-text flex h-9 w-9 items-center justify-center rounded-full text-white">
					<Icon icon="Money" size="18px" />
				</div>
			<div>
				<h3 class="text-xl font-semibold text-gray-900">Semesterersättning</h3>
				<p class="text-sm text-gray-500">Följ ackumulerad semesterersättning per användare.</p>
			</div>
		</div>
	</div>

	{#if !isAdmin}
		<p class="mt-4 rounded-md bg-gray-100 p-4 text-sm text-gray-700">
			Administratörsbehörighet krävs för att hantera semesterersättning.
		</p>
	{:else}
		{#if loadError}
			<div class="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
		{/if}

		{#if isLoading}
			<p class="mt-4 text-sm text-gray-600">Laddar...</p>
		{:else if entries.length === 0}
			<p class="mt-4 text-sm text-gray-600">Inga användare hittades.</p>
		{:else}
			<div class="mt-4 divide-y rounded-md border border-gray-200">
				{#each entries as entry (entry.userId)}
					<div class="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
						<div>
							<p class="text-sm font-semibold text-gray-900">
								{entry.firstname} {entry.lastname}
							</p>
							<p class="text-xs text-gray-500">
								Senast uppdaterad: {formatDate(entry.updatedAt)}
							</p>
						</div>

						<div class="flex flex-col items-start gap-2 md:flex-row md:items-center md:gap-3">
							<div class="relative w-full min-w-[160px]">
								<input
									class="w-full rounded border border-gray-300 py-2 pl-3 pr-12 text-sm text-gray-800 shadow-sm transition focus:border-gray-500 focus:outline-hidden"
									type="number"
									inputmode="decimal"
									step="0.01"
									min="0"
									value={entry.amountInput}
									disabled={savingUserId === entry.userId}
									on:input={(event) =>
										updateAmountInput(
											entry.userId,
											(event.currentTarget as HTMLInputElement).value
										)}
								/>
								<span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-500">kr</span>
							</div>
							<Button
								text={savingUserId === entry.userId ? 'Sparar...' : 'Spara'}
								iconLeft="Save"
								variant="primary"
								small
								disabled={savingUserId === entry.userId || !isDirty(entry)}
								on:click={() => handleSave(entry)}
							/>
						</div>

						{#if rowErrors[entry.userId]}
							<p class="text-xs text-red-600">{rowErrors[entry.userId]}</p>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
