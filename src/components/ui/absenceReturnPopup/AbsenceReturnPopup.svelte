<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Button from '../../bits/button/Button.svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import { saveOrUpdateAbsences } from '$lib/services/api/availabilityService';
	import { closePopup } from '$lib/stores/popupStore';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import {
		dispatchAbsenceUpdated,
		type CurrentAbsence
	} from '$lib/helpers/availability/currentAbsence';

	export let userId: number;
	export let absence: CurrentAbsence | null = null;

	const dispatch = createEventDispatcher<{
		resolved: { action: 'continued' | 'returned'; absenceId: number | null };
	}>();

	let processing = false;

	function toDateInput(value?: string | null) {
		if (!value) return '';
		const matchedDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
		if (matchedDate) return matchedDate;

		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return '';

		const year = parsed.getFullYear();
		const month = String(parsed.getMonth() + 1).padStart(2, '0');
		const day = String(parsed.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function formatDateLabel(value?: string | null) {
		if (!value) return '';
		const matchedDate = toDateInput(value);
		if (matchedDate) {
			const [year, month, day] = matchedDate.split('-').map(Number);
			return new Date(year, month - 1, day).toLocaleDateString('sv-SE');
		}

		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return value;
		return parsed.toLocaleDateString('sv-SE');
	}

	function handleContinue() {
		dispatch('resolved', {
			action: 'continued',
			absenceId: absence?.id ?? null
		});
		closePopup();
	}

	async function handleReturn() {
		if (!absence?.id || processing) return;

		processing = true;
		try {
			await saveOrUpdateAbsences(userId, [
				{
					id: absence.id,
					end_time: new Date().toISOString(),
					status: 'Closed'
				}
			]);

			dispatchAbsenceUpdated();
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Frånvaro avslutad',
				description: 'Den pågående frånvaron är nu avslutad.'
			});

			dispatch('resolved', {
				action: 'returned',
				absenceId: absence.id
			});
			closePopup();
		} catch (error) {
			console.error('Failed to close absence from login popup', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte avsluta frånvaro',
				description: 'Försök igen om en liten stund.'
			});
		} finally {
			processing = false;
		}
	}
</script>

{#if absence}
	<div class="flex w-full flex-col gap-4">
		<div class="rounded-sm bg-red-50 p-4 shadow-xs">
			<div class="flex items-start gap-3">
				<div class="text-error mt-1">
					<Icon icon="CircleAlert" size="20px" />
				</div>
				<div class="flex-1">
					<h2 class="text-error text-lg font-semibold">Du har en pågående frånvaro</h2>
					<p class="mt-2 text-sm text-gray-800">
						Är du tillbaka från frånvaron eller är du fortsatt frånvarande?
					</p>
					{#if absence.description?.trim()}
						<p class="mt-3 text-sm text-gray-700">
							<strong>Beskrivning:</strong>
							{absence.description.trim()}
						</p>
					{/if}
					<p class="mt-1 text-sm text-gray-700">
						<strong>Från:</strong>
						{formatDateLabel(absence.start_time)}
						{#if absence.end_time}
							<strong class="ml-2">Till:</strong> {formatDateLabel(absence.end_time)}
						{/if}
					</p>
				</div>
			</div>
		</div>

		<div class="mt-2 flex flex-col items-stretch gap-3 border-t pt-4 sm:flex-row sm:justify-end">
			<Button
				text="Jag är fortsatt frånvarande"
				variant="cancel"
				disabled={processing}
				on:click={handleContinue}
			/>
			<Button
				text="Jag är tillbaka från frånvaron"
				variant="primary"
				disabled={processing}
				on:click={handleReturn}
			/>
		</div>
	</div>
{:else}
	<p class="text-sm text-gray-500">Ingen pågående frånvaro hittades.</p>
{/if}
