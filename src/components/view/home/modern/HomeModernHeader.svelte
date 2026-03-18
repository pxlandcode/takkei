<script lang="ts">
	import { onMount } from 'svelte';
	import type { ComponentType } from 'svelte';
	import Button from '../../../bits/button/Button.svelte';
	import BookingPopup from '../../../ui/bookingPopup/BookingPopup.svelte';
	import HomeAbsencePopup from '../HomeAbsencePopup.svelte';
	import { fetchAvailability, saveOrUpdateAbsences } from '$lib/services/api/availabilityService';
	import { openPopup } from '$lib/stores/popupStore';
	import { addToast } from '$lib/stores/toastStore';
	import { user } from '$lib/stores/userStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import {
		ABSENCE_UPDATED_EVENT,
		dispatchAbsenceUpdated,
		resolveCurrentAbsence,
		type CurrentAbsence as HomeAbsence
	} from '$lib/helpers/availability/currentAbsence';
	import { formatLongDate } from './homeModernUtils';

	let mounted = false;
	let currentAbsence: HomeAbsence | null = null;
	let absenceLoading = false;
	let absenceActionLoading = false;
	let hasLoadedAbsence = false;
	let absenceUserId: number | null = null;

	function openBookingPopup(initialStartTime: Date | null = null) {
		openPopup({
			header: 'Bokning',
			icon: 'Plus',
			component: BookingPopup,
			maxWidth: '650px',
			props: { startTime: initialStartTime }
		});
	}

	onMount(() => {
		mounted = true;

		const handleAbsenceUpdated = () => {
			if ($user?.kind === 'trainer') {
				void loadCurrentAbsence();
			}
		};

		if (typeof window !== 'undefined') {
			window.addEventListener(ABSENCE_UPDATED_EVENT, handleAbsenceUpdated);
		}

		if ($user?.kind === 'trainer') {
			void loadCurrentAbsence();
		}

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener(ABSENCE_UPDATED_EVENT, handleAbsenceUpdated);
			}
		};
	});

	$: if ($user?.kind === 'trainer' && $user.id !== absenceUserId) {
		absenceUserId = $user.id;
		hasLoadedAbsence = false;
		currentAbsence = null;
	}

	$: if ($user?.kind !== 'trainer' && absenceUserId !== null) {
		absenceUserId = null;
		hasLoadedAbsence = false;
		currentAbsence = null;
	}

	$: if (mounted && $user?.kind === 'trainer' && !hasLoadedAbsence && !absenceLoading) {
		void loadCurrentAbsence();
	}

	async function loadCurrentAbsence() {
		if ($user?.kind !== 'trainer') return;

		absenceLoading = true;
		try {
			const availability = await fetchAvailability($user.id, { cache: false });
			const absences = Array.isArray(availability?.absences)
				? (availability.absences as HomeAbsence[])
				: [];
			currentAbsence = resolveCurrentAbsence(absences);
		} catch (error) {
			console.error('Failed to load current absence', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte hämta frånvaro',
				description: 'Försök igen om knappen inte visar rätt status.'
			});
		} finally {
			absenceLoading = false;
			hasLoadedAbsence = true;
		}
	}

	async function handleAbsenceStarted() {
		await loadCurrentAbsence();
		addToast({
			type: AppToastType.SUCCESS,
			message: 'Frånvaro registrerad',
			description: 'Frånvaron är nu sparad.'
		});
	}

	function openStartAbsencePopup() {
		if ($user?.kind !== 'trainer') return;

		openPopup({
			header: 'Frånvaro',
			icon: 'Inactive',
			maxWidth: '900px',
			component: HomeAbsencePopup as unknown as ComponentType,
			props: {
				userId: $user.id,
				onSaved: handleAbsenceStarted
			}
		});
	}

	async function endCurrentAbsence() {
		if ($user?.kind !== 'trainer' || !currentAbsence?.id) return;

		absenceActionLoading = true;
		try {
			await saveOrUpdateAbsences($user.id, [
				{
					id: currentAbsence.id,
					end_time: new Date().toISOString(),
					status: 'Closed'
				}
			]);

			dispatchAbsenceUpdated();
			await loadCurrentAbsence();
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Frånvaro avslutad',
				description: 'Den pågående frånvaron är nu avslutad.'
			});
		} catch (error) {
			console.error('Failed to end current absence', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte avsluta frånvaro',
				description: 'Försök igen om en liten stund.'
			});
		} finally {
			absenceActionLoading = false;
		}
	}
</script>

<header class="mb-8">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<p class="text-sm font-medium text-gray-500 capitalize">{formatLongDate(new Date())}</p>
			<h1 class="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Hej, {$user?.firstname} 👋</h1>
		</div>
		<div class="flex flex-wrap gap-2">
			{#if $user?.kind === 'trainer'}
				{#if currentAbsence}
					<Button
						text="Avsluta frånvaro"
						iconLeft="Check"
						variant="cancel"
						iconLeftSize="16"
						disabled={absenceLoading || absenceActionLoading}
						confirmOptions={{
							title: 'Avsluta frånvaro?',
							description: currentAbsence.description?.trim()
								? `Frånvaron "${currentAbsence.description.trim()}" avslutas nu.`
								: 'Den pågående frånvaron avslutas nu.',
							action: endCurrentAbsence,
							actionLabel: 'Avsluta'
						}}
					/>
				{:else}
					<Button
						text={absenceLoading && !hasLoadedAbsence ? 'Laddar...' : 'Frånvaro'}
						iconLeft="Inactive"
						variant="danger-outline"
						iconLeftSize="16"
						disabled={absenceLoading || absenceActionLoading}
						on:click={openStartAbsencePopup}
					/>
				{/if}
			{/if}
			<Button
				text="Ny bokning"
				iconLeft="Plus"
				variant="primary"
				iconLeftSize="16"
				on:click={() => openBookingPopup(null)}
			/>
		</div>
	</div>
</header>
