<script lang="ts">
	import type { FullBooking } from '$lib/types/calendarTypes';
	import Button from '../../bits/button/Button.svelte';
	import { formatTime } from '$lib/helpers/calendarHelpers/calendar-utils';
	import { createEventDispatcher, onMount } from 'svelte';
	import BookingEditor from '../bookingEditor/BookingEditor.svelte';
	import { bookingContents } from '$lib/stores/bookingContentStore';
	import { calendarStore } from '$lib/stores/calendarStore';
	import { addToast } from '$lib/stores/toastStore';
	import {
		cancelBooking,
		deleteMeetingBooking,
		deletePersonalBooking
	} from '$lib/services/api/bookingService';
	import { AppToastType } from '$lib/types/toastTypes';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import { sendMail } from '$lib/services/mail/mailClientService';
	import { getClientEmails } from '$lib/stores/clientsStore';
	import { get } from 'svelte/store';
	import { user } from '$lib/stores/userStore';
	import { users, fetchUsers } from '$lib/stores/usersStore';

	export let booking: FullBooking;

	let currentBooking: FullBooking = booking;
	let lastPropBooking: FullBooking = booking;
	let startTime: Date;
	let endTime: Date;

	const dispatch = createEventDispatcher();

	$: if (booking !== lastPropBooking && booking) {
		lastPropBooking = booking;
		currentBooking = booking;
	}

	$: {
		const start = new Date(currentBooking.booking.startTime);
		startTime = start;
		endTime = currentBooking.booking.endTime
			? new Date(currentBooking.booking.endTime)
			: new Date(start.getTime() + 60 * 60 * 1000);
	}

	let showEditor = false;
	let editedBooking: FullBooking | null = null;
	let participantNames: string[] = [];
	let isCancelled = false;
	let cancelOptions: {
		onConfirm: (reason: string, time: string) => void;
		startTimeISO: string;
	} | null = null;
	let confirmDeleteOptions: {
		title?: string;
		description?: string;
		action?: () => void;
		actionLabel?: string;
	} | null = null;

	function normalizeKind(kind?: string | null) {
		if (!kind) return '';
		return kind
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
	}

	function isMeetingBooking(bookingItem: FullBooking) {
		const personalKind = normalizeKind(bookingItem.personalBooking?.kind ?? null);
		const contentKind = normalizeKind(bookingItem.additionalInfo?.bookingContent?.kind ?? null);
		return (
			personalKind.includes('meeting') ||
			personalKind.includes('mote') ||
			contentKind.includes('meeting') ||
			contentKind.includes('mote')
		);
	}

	$: requiresCancelReason = !currentBooking.isPersonalBooking && !isMeetingBooking(currentBooking);
	$: cancelOptions = requiresCancelReason
		? {
				onConfirm: (reason: string, time: string) => {
					void performCancellation({ reason, time });
				},
				startTimeISO: currentBooking.booking.startTime
			}
		: null;
	$: confirmDeleteOptions = requiresCancelReason
		? null
		: {
				title: 'Ta bort bokning',
				description: 'Är du säker på att du vill ta bort den här bokningen?',
				actionLabel: 'Ta bort',
				action: () => {
					void performCancellation({});
				}
			};

	$: isCancelled =
		(currentBooking.booking.status &&
			currentBooking.booking.status.toLowerCase() === 'cancelled') ||
		!!currentBooking.booking.cancelTime;

	function fmtDateTime(d?: string | Date | null) {
		if (!d) return '';
		const date = typeof d === 'string' ? new Date(d) : d;
		// Swedish date + time, short
		return date.toLocaleString('sv-SE', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function cloneBookingData(source: FullBooking): FullBooking {
		return JSON.parse(JSON.stringify(source));
	}

	onMount(async () => {
		if (currentBooking.isPersonalBooking && get(users).length === 0) {
			await fetchUsers();
		}

		if (currentBooking.isPersonalBooking && currentBooking.personalBooking?.userIds?.length) {
			const loadedUsers = get(users);
			const idSet = new Set(currentBooking.personalBooking.userIds);
			participantNames = loadedUsers
				.filter((u) => idSet.has(u.id))
				.map((u) => `${u.firstname} ${u.lastname}`);
		}
	});

	$: if (currentBooking.isPersonalBooking) {
		const userList = $users;
		if (userList.length && currentBooking.personalBooking?.userIds?.length) {
			const idSet = new Set(currentBooking.personalBooking.userIds);
			participantNames = userList
				.filter((u) => idSet.has(u.id))
				.map((u) => `${u.firstname} ${u.lastname}`);
		} else {
			participantNames = [];
		}
	}

	function handleEdit() {
		if (isCancelled) return;
		editedBooking = cloneBookingData(currentBooking);
		showEditor = true;
	}

	async function performCancellation({ reason, time }: { reason?: string; time?: string }) {
		const personalBooking = currentBooking.isPersonalBooking;
		const meetingBooking = isMeetingBooking(currentBooking);

		let res: { success: boolean; message?: string };

		if (personalBooking) {
			res = await deletePersonalBooking(currentBooking.booking.id);
		} else if (meetingBooking) {
			res = await deleteMeetingBooking(currentBooking.booking.id);
		} else {
			if (!reason) {
				addToast({
					type: AppToastType.CANCEL,
					message: 'Orsak saknas',
					description: 'Vänligen välj en avbokningsorsak.'
				});
				return;
			}
			const fallbackTime = new Date().toISOString().slice(0, 16);
			res = await cancelBooking(currentBooking.booking.id, reason, time ?? fallbackTime);
		}

		if (res.success) {
			const clientEmail = !personalBooking ? getClientEmails(currentBooking.client?.id) : null;
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
				message: personalBooking || meetingBooking ? 'Bokning borttagen' : 'Bokning avbruten',
				description: res.message ?? 'Bokningen har uppdaterats.'
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

	function handleCloseEditor(event: CustomEvent<{ booking?: FullBooking }>) {
		const updated = event?.detail?.booking;
		if (updated) {
			currentBooking = updated;
		}
		showEditor = false;
		dispatch('updated', { booking: currentBooking });
	}
</script>

{#if showEditor && editedBooking}
	<div class="w-full">
		<BookingEditor
			booking={editedBooking}
			bookingContentOptions={$bookingContents.map((b) => ({ value: b.id, label: b.kind }))}
			on:close={handleCloseEditor}
		/>
	</div>
{:else if showEditor}
	<p class="text-gray p-4 text-sm">Laddar redigeringsformulär...</p>
{:else}
	<div class="flex w-full max-w-full flex-col gap-4 bg-white sm:w-[600px] sm:max-w-[600px]">
		<div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-xl font-semibold">Bokningsdetaljer</h2>

			<div class="flex flex-wrap gap-2 sm:flex-nowrap sm:justify-end sm:gap-3">
				{#if !isCancelled}
					<Button iconLeft="Edit" text="Redigera" variant="primary" small on:click={handleEdit} />
					<Button
						iconLeft="Trash"
						iconColor="error"
						text="Ta bort"
						variant="danger-outline"
						small
						cancelConfirmOptions={cancelOptions}
						confirmOptions={confirmDeleteOptions}
					/>
				{:else}
					<!-- Optional: just a close button when canceled -->
					<Button text="Stäng" variant="secondary" small on:click={onClose} />
				{/if}
			</div>
		</div>

		<!-- Canceled banner -->
		{#if isCancelled}
			<div class="mx-1 rounded-md border border-rose-300 bg-rose-100 p-3 text-rose-900">
				<div class="flex items-center gap-2">
					<Icon icon="CircleAlert" size="18px" color="error" />
					<span class="font-semibold">Avbokad</span>
				</div>

				{#if currentBooking.booking.cancelReason}
					<p class="mt-1 text-sm"><strong>Orsak:</strong> {currentBooking.booking.cancelReason}</p>
				{/if}

				<div class="mt-1 space-y-1 text-xs">
					{#if currentBooking.booking.actualCancelTime}
						<p>
							<strong>Kundens avbokningstid:</strong>
							{fmtDateTime(currentBooking.booking.actualCancelTime)}
						</p>
					{/if}
					{#if currentBooking.booking.cancelTime}
						<p>
							<strong>Registrerad i systemet:</strong>
							{fmtDateTime(currentBooking.booking.cancelTime)}
						</p>
					{/if}
				</div>
			</div>
		{/if}

		<div class={isCancelled ? 'pointer-events-none opacity-60 select-none' : ''}>
			{#if currentBooking.isPersonalBooking}
				<p class="text-gray-700">
					<strong>Namn:</strong>

					{currentBooking.personalBooking?.name}
				</p>
				{#if currentBooking.personalBooking?.text}
					<p class="text-gray-700">
						<strong>Beskrivning:</strong>
						{currentBooking.personalBooking?.text}
					</p>
				{/if}
				<p class="text-gray-700"><strong>Deltagare:</strong></p>
				<ul class="ml-4 list-disc text-sm text-gray-700">
					{#each participantNames as name}
						<li>{name}</li>
					{/each}
				</ul>
			{:else}
				<p class="text-gray-700">
					<strong>Kund:</strong>
					<a class="text-orange hover:underline" href={`/clients/${currentBooking.client?.id}`}>
						{currentBooking.client?.firstname}
						{currentBooking.client?.lastname}
					</a>
				</p>
				<p class="text-gray-700">
					<strong>Tränare:</strong>
					<a class="text-orange hover:underline" href={`/users/${currentBooking.trainer?.id}`}>
						{currentBooking.trainer?.firstname}
						{currentBooking.trainer?.lastname}
					</a>
				</p>
				<p class="text-gray-700">
					<strong>Plats:</strong>
					{currentBooking.location?.name ?? 'Saknas'}
				</p>
			{/if}

			<p class={`text-gray-700 ${isCancelled ? 'line-through' : ''}`}>
				<strong>Tid:</strong>
				{formatTime(startTime.toISOString())} – {formatTime(endTime.toISOString())}
			</p>

			{#if currentBooking.booking.tryOut}
				<p class="font-semibold text-orange-600">Prova-på-bokning</p>
			{/if}
		</div>
	</div>
{/if}
