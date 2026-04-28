<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '../../bits/button/Button.svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import OptionButton from '../../bits/optionButton/OptionButton.svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import { openPopup } from '$lib/stores/popupStore';
	import {
		deleteStandbyTime,
		fetchStandbyTimes,
		StandbyApiError
	} from '$lib/services/api/standbyTimeService';
	import StandbyTimePopup from './StandbyTimePopup.svelte';
	import type {
		StandbyMutationResponse,
		StandbyTimeRecord,
		StandbyWarnings
	} from '$lib/types/standbyTypes';

	const viewOptions = [
		{ value: false, label: 'Aktiva' },
		{ value: true, label: 'Visa alla' }
	];

	let selectedView = viewOptions[0];
	let standbyTimes: StandbyTimeRecord[] = [];
	let loading = false;
	let error: string | null = null;
	let lastWarnings: StandbyWarnings | null = null;

	function getErrorMessage(errorValue: unknown) {
		if (errorValue instanceof StandbyApiError) return errorValue.message;
		if (errorValue instanceof Error) return errorValue.message;
		return 'Något gick fel.';
	}

	async function loadStandbyTimes() {
		loading = true;
		error = null;

		try {
			standbyTimes = await fetchStandbyTimes(selectedView.value === true);
		} catch (loadError) {
			console.error('Failed to load standby times', loadError);
			error = getErrorMessage(loadError);
		} finally {
			loading = false;
		}
	}

	async function handleSaved(result: StandbyMutationResponse) {
		lastWarnings = result.warnings.availableStarts.length > 0 ? result.warnings : null;
		await loadStandbyTimes();
		addToast({
			type: AppToastType.SUCCESS,
			message: 'Standbytid sparad',
			description: 'Standbytiden har sparats.'
		});
	}

	function openCreatePopup() {
		openPopup({
			header: 'Ny standbytid',
			icon: 'Clock',
			component: StandbyTimePopup,
			maxWidth: '760px',
			props: {
				onSaved: handleSaved
			}
		});
	}

	function openEditPopup(standbyTime: StandbyTimeRecord) {
		openPopup({
			header: 'Redigera standbytid',
			icon: 'Edit',
			component: StandbyTimePopup,
			maxWidth: '760px',
			props: {
				standbyTime,
				onSaved: handleSaved
			}
		});
	}

	async function handleDelete(standbyTime: StandbyTimeRecord) {
		try {
			await deleteStandbyTime(standbyTime.id);
			standbyTimes = standbyTimes.filter((row) => row.id !== standbyTime.id);
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Standbytid borttagen',
				description: 'Standbytiden har tagits bort.'
			});
		} catch (deleteError) {
			console.error('Failed to delete standby time', deleteError);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ta bort standbytid',
				description: getErrorMessage(deleteError)
			});
		}
	}

	function handleViewSelect(event: CustomEvent<boolean>) {
		selectedView = viewOptions.find((option) => option.value === event.detail) ?? viewOptions[0];
		loadStandbyTimes();
	}

	function joinLocations(standbyTime: StandbyTimeRecord) {
		return standbyTime.locations.map((location) => location.name).join(', ') || 'Inga platser';
	}

	function joinTrainers(standbyTime: StandbyTimeRecord) {
		return (
			standbyTime.trainers
				.map((trainer) => `${trainer.firstname} ${trainer.lastname}`)
				.join(', ') || 'Inga tränare'
		);
	}

	function getCreatorBadgeLabel(standbyTime: StandbyTimeRecord) {
		if (standbyTime.isOwner) {
			return 'Skapad av dig';
		}

		if (standbyTime.owner) {
			return `Skapad av ${standbyTime.owner.firstname} ${standbyTime.owner.lastname}`;
		}

		return null;
	}

	onMount(() => {
		loadStandbyTimes();
	});
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="text-xl font-semibold">Standbytid</h2>
			<p class="mt-1 text-sm text-gray-500">
				Skapa bevakningar för lediga tider. Mail skickas när en bokning avbokas och matchar önskat
				intervall.
			</p>
		</div>

		<div class="flex w-full flex-wrap items-end justify-between gap-3">
			<div class="min-w-[220px]">
				<OptionButton
					label="Visa"
					options={viewOptions}
					bind:selectedOption={selectedView}
					variant="gray"
					size="small"
					full
					on:select={handleViewSelect}
				/>
			</div>
			<Button text="Ny standbytid" iconLeft="Plus" small on:click={openCreatePopup} />
		</div>
	</div>

	<div class="rounded-sm border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
		Standbytid bokar inte tiden automatiskt. Den skickar bara ett mail till valda tränare när en
		avbokning skapar en matchande ledig starttid.
	</div>

	{#if lastWarnings}
		<div class="rounded-sm border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p class="font-semibold">Det finns redan lediga tider i det önskade intervallet.</p>
					<p class="mt-1">
						Du blir bara varnad om ytterligare tider blir lediga. Lediga starttider just nu:
					</p>
					<ul class="mt-2 list-disc pl-5">
						{#each lastWarnings.availableStarts as availableStart}
							<li>
								{availableStart.date} kl. {availableStart.time} på {availableStart.locationName}
							</li>
						{/each}
					</ul>
				</div>

				<Button text="Dölj" variant="secondary" small on:click={() => (lastWarnings = null)} />
			</div>
		</div>
	{/if}

	{#if error}
		<div class="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
	{/if}

	{#if loading}
		<div class="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-500">
			Laddar standbytider...
		</div>
	{:else if standbyTimes.length === 0}
		<div class="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-500">
			Inga standbytider att visa.
		</div>
	{:else}
		<div class="grid gap-4">
			{#each standbyTimes as standbyTime (standbyTime.id)}
				<article class="rounded-sm border border-gray-200 bg-white p-5 shadow-xs">
					<div class="flex flex-wrap items-start justify-between gap-4">
						<div class="space-y-3">
							<div class="flex flex-wrap items-center gap-2">
								<div class="flex items-center gap-2 text-sm font-semibold text-gray-900">
									<Icon icon="Clock" size="16px" />
									<span>
										{standbyTime.date} kl. {standbyTime.startTime} - {standbyTime.endTime}
									</span>
								</div>
								{#if standbyTime.expired}
									<span
										class="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600"
									>
										Utgången
									</span>
								{/if}
								{#if getCreatorBadgeLabel(standbyTime)}
									<span
										class="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700"
									>
										{getCreatorBadgeLabel(standbyTime)}
									</span>
								{/if}
							</div>

							<div class="grid gap-2 text-sm text-gray-700 md:grid-cols-2">
								<div>
									<p class="text-xs font-semibold tracking-wide text-gray-500 uppercase">Platser</p>
									<p class="mt-1">{joinLocations(standbyTime)}</p>
								</div>
								<div>
									<p class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
										Tränare som får mail
									</p>
									<p class="mt-1">{joinTrainers(standbyTime)}</p>
								</div>
								{#if standbyTime.client}
									<div>
										<p class="text-xs font-semibold tracking-wide text-gray-500 uppercase">Kund</p>
										<p class="mt-1">
											{standbyTime.client.firstname}
											{standbyTime.client.lastname}
										</p>
									</div>
								{/if}
							</div>

							{#if standbyTime.comment}
								<div>
									<p class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
										Kommentar
									</p>
									<p class="mt-1 text-sm text-gray-700">{standbyTime.comment}</p>
								</div>
							{/if}
						</div>

						{#if standbyTime.isOwner}
							<div class="flex flex-wrap gap-2">
								<Button
									text="Redigera"
									iconLeft="Edit"
									variant="secondary"
									small
									on:click={() => openEditPopup(standbyTime)}
								/>
								<Button
									text="Ta bort"
									variant="danger-outline"
									small
									confirmOptions={{
										title: 'Ta bort standbytid',
										description: 'Är du säker på att du vill ta bort standbytiden?',
										actionLabel: 'Ta bort',
										action: () => {
											void handleDelete(standbyTime);
										}
									}}
								/>
							</div>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>
