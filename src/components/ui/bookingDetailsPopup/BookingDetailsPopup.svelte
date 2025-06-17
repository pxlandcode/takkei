<script lang="ts">
	import type { FullBooking } from '$lib/types/calendarTypes';
	import Button from '../../bits/button/Button.svelte';
	import { formatTime } from '$lib/helpers/calendarHelpers/calendar-utils';
	import { createEventDispatcher } from 'svelte';
	import BookingEditor from '../bookingEditor/BookingEditor.svelte';
	import { bookingContents } from '$lib/stores/bookingContentStore';
	import { calendarStore } from '$lib/stores/calendarStore';
	import { addToast } from '$lib/stores/toastStore';
	import { cancelBooking } from '$lib/services/api/bookingService';
	import { AppToastType } from '$lib/types/toastTypes';
	import { cancelConfirm } from '$lib/actions/cancelConfirm.ts';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import { sendMail } from '$lib/services/mail/mailClientService';
	import { getClientEmails } from '$lib/stores/clientsStore';
	import { get } from 'svelte/store';
	import { user } from '$lib/stores/userStore';

	export let booking: FullBooking;

	const dispatch = createEventDispatcher();

	const startTime = new Date(booking.booking.startTime);
	const endTime = new Date(booking.booking.endTime ?? startTime.getTime() + 60 * 60 * 1000);

	let showEditor = false;
	let editedBooking = null;

	function handleEdit() {
		editedBooking = {
			id: booking.booking.id,
			clientId: booking.client?.id ?? null,
			trainerId: booking.trainer?.id ?? null,
			roomId: booking.room?.id ?? null,
			locationId: booking.location?.id ?? null,
			bookingType: {
				value: booking.additionalInfo.bookingContent?.id ?? '',
				label: booking.additionalInfo.bookingContent?.kind ?? 'Okänd'
			},
			date: startTime.toISOString().slice(0, 10),
			time: startTime.toISOString().slice(11, 16),
			status: booking.booking.status
		};
		showEditor = true;
	}

	async function handleCancel(reason: string, time: string) {
		const res = await cancelBooking(booking.booking.id, reason, time);

		if (res.success) {
			const clientEmail = getClientEmails(booking.client?.id);
			const currentUser = get(user);

			if (clientEmail) {
				await sendMail({
					to: clientEmail,
					subject: 'Avbokningsbekräftelse',
					header: 'Din bokning har avbokats',
					subheader: 'Vi har noterat din avbokning',
					body: `
					Hej! Din bokning den ${startTime.toLocaleDateString('sv-SE')} har avbokats.<br><br>
					Tveka inte att kontakta oss om du har några frågor.
				`,
					from: {
						name: `${currentUser.firstname} ${currentUser.lastname}`,
						email: currentUser.email
					}
				});
			}

			addToast({
				type: AppToastType.SUCCESS,
				message: 'Bokning avbruten',
				description: 'Bokningen har avbrutits och e-post har skickats.'
			});

			calendarStore.refresh(fetch);
			onClose();
		} else {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid avbokning',
				description: res.message ?? 'Något gick fel.'
			});
		}
	}

	function onClose() {
		dispatch('close');
	}

	function handleCloseEditor() {
		showEditor = false;
		dispatch('updated');
	}
</script>

{#if showEditor}
	<BookingEditor
		bookingObject={editedBooking}
		bookingContents={$bookingContents.map((b) => ({ value: b.id, label: b.kind }))}
		on:close={handleCloseEditor}
	/>
{:else}
	<div class="flex w-[600px] flex-col gap-4 bg-white">
		<div class="mt-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold">Bokningsdetaljer</h2>
			<div class="flex gap-4">
				<Button iconLeft="Edit" text="Redigera" variant="primary" small on:click={handleEdit} />
				<button
					use:cancelConfirm={{ onConfirm: handleCancel }}
					class="flex items-center gap-2 rounded-md border border-gray bg-white px-3 py-1 text-sm text-error hover:bg-error/10 hover:text-error-hover"
				>
					<Icon icon="Trash" size="16px" color="error" />
					Ta bort
				</button>
			</div>
		</div>

		<p class="text-gray-600">
			<strong>Kund:</strong>
			{booking.client?.firstname}
			{booking.client?.lastname}
		</p>
		<p class="text-gray-600">
			<strong>Tränare:</strong>
			{booking.trainer?.firstname}
			{booking.trainer?.lastname}
		</p>
		<p class="text-gray-600">
			<strong>Plats:</strong>
			{booking.location?.name ?? 'Saknas'}
		</p>
		<p class="text-gray-600">
			<strong>Typ:</strong>
			{booking.additionalInfo.bookingContent?.kind ?? 'Okänd'}
		</p>
		<p class="text-gray-600">
			<strong>Tid:</strong>
			{formatTime(startTime.toISOString())} – {formatTime(endTime.toISOString())}
		</p>

		{#if booking.booking.tryOut}
			<p class="font-semibold text-orange-600">Prova-på-bokning</p>
		{/if}
	</div>
{/if}
