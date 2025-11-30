<script lang="ts">
	import type { FullBooking } from '$lib/types/calendarTypes';
	import Button from '../../bits/button/Button.svelte';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import SlotTimePicker from '../../bits/slotTimePicker/SlotTimePicker.svelte';
	import { formatTime } from '$lib/helpers/calendarHelpers/calendar-utils';
	import { createEventDispatcher, onMount } from 'svelte';
	import BookingEditor from '../bookingEditor/BookingEditor.svelte';
	import MailComponent from '../mailComponent/MailComponent.svelte';
	import { bookingContents } from '$lib/stores/bookingContentStore';
	import { calendarStore } from '$lib/stores/calendarStore';
	import { addToast } from '$lib/stores/toastStore';
	import {
		cancelBooking,
		deleteMeetingBooking,
		deletePersonalBooking,
		fetchAvailableSlots,
		updateStandardBooking
	} from '$lib/services/api/bookingService';
	import { AppToastType } from '$lib/types/toastTypes';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import { sendMail } from '$lib/services/mail/mailClientService';
	import { fetchClients, getClientEmails } from '$lib/stores/clientsStore';
	import { get } from 'svelte/store';
	import { user } from '$lib/stores/userStore';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import { openPopup, popupStore, closePopup, type PopupState } from '$lib/stores/popupStore';

	type BookingComponentType =
		| 'training'
		| 'trial'
		| 'practice'
		| 'education'
		| 'flight'
		| 'meeting'
		| 'personal';

	const componentLabels: Record<BookingComponentType, string> = {
		training: 'Träning',
		trial: 'Provträning',
		practice: 'Praktiktimme',
		education: 'Utbildning',
		flight: 'Flygtimme',
		meeting: 'Möte',
		personal: 'Personlig'
	};

	export let booking: FullBooking;

	let currentBooking: FullBooking = booking;
	let lastPropBooking: FullBooking = booking;
	let startTime: Date;
	let endTime: Date;

	const dispatch = createEventDispatcher();
	const popupInstance: PopupState | null = get(popupStore);

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
		onConfirm: (reason: string, time: string, emailBehavior: 'send' | 'edit' | 'none') => void;
		startTimeISO: string;
		defaultEmailBehavior?: 'send' | 'edit' | 'none';
	} | null = null;
	let confirmDeleteOptions: {
		title?: string;
		description?: string;
		action?: () => void;
		actionLabel?: string;
	} | null = null;
	let showTraineeParticipant = false;
	let participantLabel = 'Kund';
	let participantEntry: {
		id?: number | null;
		firstname?: string | null;
		lastname?: string | null;
	} | null = null;
	let bookingComponentType: BookingComponentType = 'training';
	let bookingTypeLabel = componentLabels[bookingComponentType];
	type QuickEditField = 'trainer' | 'location' | 'time' | null;

	let activeQuickEdit: QuickEditField = null;
	let trainerSwapOptions: { label: string; value: number }[] = [];
	let locationSwapOptions: { label: string; value: number }[] = [];
	let quickEditOptionsLoading = false;
	let quickEditSavingField: QuickEditField = null;
	let quickEditDate = '';
	let quickEditTime = '';
	let pendingTrainerSelection: number | null = null;
	let pendingLocationSelection: number | null = null;
	let canQuickSwap = false;
	let currentTrainerId: number | null = null;
	let currentLocationId: number | null = null;
	let currentBookingDate = '';
	let currentBookingTime = '';

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
				onConfirm: (reason: string, time: string, emailBehavior: 'send' | 'edit' | 'none') => {
					void performCancellation({ reason, time, emailBehavior });
				},
				startTimeISO: currentBooking.booking.startTime,
				defaultEmailBehavior: 'none'
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
	$: showTraineeParticipant =
		!currentBooking.isPersonalBooking &&
		(currentBooking.booking.internalEducation || currentBooking.additionalInfo?.education);
	$: participantLabel = showTraineeParticipant ? 'Trainee' : 'Kund';
	$: participantEntry = showTraineeParticipant
		? currentBooking.trainee
		: (currentBooking.client ?? null);
	$: bookingComponentType = determineBookingComponent(currentBooking);
	$: bookingTypeLabel = componentLabels[bookingComponentType];
	$: canQuickSwap = !currentBooking.isPersonalBooking && !isMeetingBooking(currentBooking);
	$: currentTrainerId = currentBooking.trainer?.id ?? null;
	$: currentLocationId = currentBooking.location?.id ?? null;
	$: currentBookingDate = toDateInputValue(new Date(currentBooking.booking.startTime));
	$: currentBookingTime = toTimeInputValue(new Date(currentBooking.booking.startTime));
	$: if (!activeQuickEdit) {
		pendingTrainerSelection = currentTrainerId;
		pendingLocationSelection = currentLocationId;
	}

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

	async function performCancellation({
		reason,
		time,
		emailBehavior = 'none'
	}: {
		reason?: string;
		time?: string;
		emailBehavior?: 'send' | 'edit' | 'none';
	}) {
		const personalBooking = currentBooking.isPersonalBooking;
		const meetingBooking = isMeetingBooking(currentBooking);

		let res: { success: boolean; message?: string };

		const handleCancellationEmail = async (behavior: 'send' | 'edit' | 'none') => {
			if (behavior === 'none') return;
			const clientId = currentBooking.client?.id;
			if (!clientId) return;

			const resolveRecipients = async () => {
				let emails = getClientEmails(clientId);

				if (!emails.length) {
					const inlineEmail = currentBooking.client?.email;
					if (inlineEmail) emails = [inlineEmail];
				}

				if (!emails.length) {
					try {
						await fetchClients();
						emails = getClientEmails(clientId);
					} catch (error) {
						console.error('Failed to fetch clients for cancellation email', error);
					}
				}

				return emails;
			};

			const recipients = await resolveRecipients();
			if (!recipients.length) {
				addToast({
					type: AppToastType.CANCEL,
					message: 'Ingen e-postadress',
					description: 'Kunden saknar e-postadress, så inget mail skickades.'
				});
				return;
			}

			const currentUser = get(user);
			const bookingDate = startTime.toLocaleDateString('sv-SE');
			const bookingTime = formatTime(startTime.toISOString());
			const emailBody = `Hej! Din bokning den ${bookingDate} kl ${bookingTime} har avbokats.<br><br>Tveka inte att kontakta oss om du har några frågor.`;

			const mailConfig = {
				to: recipients,
				subject: 'Avbokningsbekräftelse',
				header: 'Din bokning har avbokats',
				subheader: 'Vi har noterat din avbokning',
				body: emailBody,
				from: {
					name: `${currentUser.firstname} ${currentUser.lastname}`,
					email: currentUser.email
				}
			};

			if (behavior === 'send') {
				try {
					await sendMail(mailConfig);
					addToast({
						type: AppToastType.SUCCESS,
						message: 'Bekräftelsemail skickat',
						description: `Ett bekräftelsemail skickades till ${recipients.join(', ')}.`
					});
				} catch (error) {
					console.error('Failed to send cancellation email', error);
					addToast({
						type: AppToastType.CANCEL,
						message: 'Mail kunde inte skickas',
						description: 'Avbokningsbekräftelsen kunde inte skickas automatiskt.'
					});
				}
				return;
			}

			if (behavior === 'edit') {
				openPopup({
					header: `Maila avbokningsbekräftelse till ${recipients.join(', ')}`,
					icon: 'Mail',
					component: MailComponent,
					width: '900px',
					props: {
						prefilledRecipients: recipients,
						subject: mailConfig.subject,
						header: mailConfig.header,
						subheader: mailConfig.subheader,
						body: emailBody,
						lockedFields: ['recipients'],
						autoFetchUsersAndClients: false
					}
				});
			}
		};

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
			if (!personalBooking && !meetingBooking) {
				await handleCancellationEmail(emailBehavior);
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
		if (get(popupStore) === popupInstance) {
			closePopup();
		}
	}

	function handleCloseEditor(event: CustomEvent<{ booking?: FullBooking }>) {
		const updated = event?.detail?.booking;
		if (updated) {
			currentBooking = updated;
		}
		showEditor = false;
		dispatch('updated', { booking: currentBooking });
	}

	function determineBookingComponent(full: FullBooking): BookingComponentType {
		if (full.isPersonalBooking) {
			const kind = (full.personalBooking?.kind ?? '').toLowerCase();
			if (kind.includes('meeting') || kind.includes('möte') || kind.includes('mote')) {
				return 'meeting';
			}
			return 'personal';
		}

		if (full.booking.tryOut) return 'trial';
		if (full.booking.internalEducation) return 'practice';
		if (full.additionalInfo?.education) return 'education';
		if (full.additionalInfo?.internal) return 'flight';
		return 'training';
	}

	function toDateInputValue(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function toTimeInputValue(date: Date): string {
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		return `${hours}:${minutes}`;
	}

	function shouldCheckTraineeConflicts(): boolean {
		return Boolean(
			currentBooking.booking.userId &&
				(currentBooking.booking.internalEducation || currentBooking.additionalInfo?.education)
		);
	}

	function getTraineeUserId(): number | null {
		return shouldCheckTraineeConflicts() && currentBooking.booking.userId
			? Number(currentBooking.booking.userId)
			: null;
	}

	function resetQuickEditState() {
		trainerSwapOptions = [];
		locationSwapOptions = [];
		activeQuickEdit = null;
		quickEditOptionsLoading = false;
		quickEditSavingField = null;
		quickEditDate = '';
		quickEditTime = '';
		pendingTrainerSelection = currentTrainerId;
		pendingLocationSelection = currentLocationId;
	}

	async function ensureUsersLoaded() {
		if (!get(users)?.length) {
			await fetchUsers();
		}
	}

	async function ensureLocationsLoaded() {
		if (!get(locations)?.length) {
			await fetchLocations();
		}
	}

	async function toggleQuickEdit(field: QuickEditField) {
		if (!canQuickSwap) return;
		if (activeQuickEdit === field) {
			resetQuickEditState();
			return;
		}

		resetQuickEditState();
		activeQuickEdit = field;
		quickEditOptionsLoading = field !== 'time';
		quickEditSavingField = null;
		if (field === 'trainer') {
			await buildTrainerSwapOptions();
		} else if (field === 'location') {
			await buildLocationSwapOptions();
		} else if (field === 'time') {
			initializeTimeEditor();
		}
	}

	async function buildTrainerSwapOptions() {
		try {
			await ensureUsersLoaded();
			const userOptions = get(users);
			const locationId = currentLocationId;
			if (!locationId) {
				addToast({
					type: AppToastType.CANCEL,
					message: 'Plats saknas',
					description: 'Kan inte byta tränare utan vald plats.'
				});
				resetQuickEditState();
				return;
			}
			const checkUsersBusy = shouldCheckTraineeConflicts();
			const traineeUserId = getTraineeUserId();
			const date = currentBookingDate;
			const time = currentBookingTime;
			const ignoreBookingId = currentBooking.booking.id;

			const availabilityChecks = await Promise.all(
				userOptions.map(async (candidate) => {
					const result = await fetchAvailableSlots({
						date,
						trainerId: candidate.id,
						locationId,
						checkUsersBusy,
						userId: traineeUserId ?? undefined,
						ignoreBookingId
					});
					if ((result.availableSlots ?? []).includes(time)) {
						return {
							label: `${candidate.firstname} ${candidate.lastname}`,
							value: candidate.id
						};
					}
					return null;
				})
			);

			trainerSwapOptions = availabilityChecks.filter(
				(option): option is { label: string; value: number } => Boolean(option)
			);

			if (trainerSwapOptions.length === 0) {
				addToast({
					type: AppToastType.CANCEL,
					message: 'Inga tränare lediga',
					description: 'Ingen tränare uppfyller reglerna för denna tid och plats.'
				});
				resetQuickEditState();
			} else {
				pendingTrainerSelection = currentTrainerId;
			}
		} catch (error) {
			console.error('Failed to load trainer swap options', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte hämta tränare',
				description: 'Försök igen eller öppna redigeraren för fler val.'
			});
			resetQuickEditState();
		} finally {
			quickEditOptionsLoading = false;
		}
	}

	async function buildLocationSwapOptions() {
		try {
			await ensureLocationsLoaded();
			const locationList = get(locations);
			const trainerId = currentTrainerId;
			if (!trainerId) {
				addToast({
					type: AppToastType.CANCEL,
					message: 'Tränare saknas',
					description: 'Kan inte byta plats utan tränare.'
				});
				resetQuickEditState();
				return;
			}

			const checkUsersBusy = shouldCheckTraineeConflicts();
			const traineeUserId = getTraineeUserId();
			const date = currentBookingDate;
			const time = currentBookingTime;
			const ignoreBookingId = currentBooking.booking.id;

			const availabilityChecks = await Promise.all(
				locationList.map(async (candidate) => {
					const result = await fetchAvailableSlots({
						date,
						trainerId,
						locationId: candidate.id,
						checkUsersBusy,
						userId: traineeUserId ?? undefined,
						ignoreBookingId
					});
					if ((result.availableSlots ?? []).includes(time)) {
						return {
							label: candidate.name,
							value: candidate.id
						};
					}
					return null;
				})
			);

			locationSwapOptions = availabilityChecks.filter(
				(option): option is { label: string; value: number } => Boolean(option)
			);

			if (locationSwapOptions.length === 0) {
				addToast({
					type: AppToastType.CANCEL,
					message: 'Inga platser lediga',
					description: 'Ingen plats är ledig för vald tränare och tid.'
				});
				resetQuickEditState();
			} else {
				pendingLocationSelection = currentLocationId;
			}
		} catch (error) {
			console.error('Failed to load location swap options', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte hämta platser',
				description: 'Försök igen eller öppna redigeraren för fler val.'
			});
			resetQuickEditState();
		} finally {
			quickEditOptionsLoading = false;
		}
	}

	function initializeTimeEditor() {
		quickEditDate = currentBookingDate;
		quickEditTime = currentBookingTime;
	}

	function buildQuickEditPayload(overrides: Record<string, any> = {}) {
		const start = new Date(currentBooking.booking.startTime);
		const payload: Record<string, any> = {
			id: currentBooking.booking.id,
			clientId: currentBooking.client?.id ?? null,
			trainerId: currentTrainerId,
			locationId: currentLocationId,
			roomId: currentBooking.room?.id ?? null,
			date: toDateInputValue(start),
			time: toTimeInputValue(start),
			bookingType: currentBooking.additionalInfo?.bookingContent
				? {
						value: currentBooking.additionalInfo.bookingContent.id,
						label: currentBooking.additionalInfo.bookingContent.kind
					}
				: null,
			status: currentBooking.booking.status ?? 'New',
			isTrial: currentBooking.booking.tryOut,
			internalEducation: currentBooking.booking.internalEducation,
			internal: currentBooking.additionalInfo?.internal ?? false,
			education: currentBooking.additionalInfo?.education ?? false,
			user_id: currentBooking.booking.userId ?? null
		};

		const merged = { ...payload, ...overrides };
		merged.trainerId =
			merged.trainerId !== null && merged.trainerId !== undefined ? Number(merged.trainerId) : null;
		merged.locationId =
			merged.locationId !== null && merged.locationId !== undefined
				? Number(merged.locationId)
				: null;
		merged.roomId =
			merged.roomId !== null && merged.roomId !== undefined ? Number(merged.roomId) : null;
		merged.clientId =
			merged.clientId !== null && merged.clientId !== undefined ? Number(merged.clientId) : null;
		merged.user_id =
			merged.user_id !== null && merged.user_id !== undefined ? Number(merged.user_id) : null;
		return merged;
	}

	function applyLocalQuickEdit(field: QuickEditField, value: Record<string, any>) {
		const updatedAt = new Date().toISOString();

		if (field === 'trainer') {
			const userList = get(users) ?? [];
			const match = userList.find((u) => u.id === value.trainerId);
			const trainer = match
				? { id: match.id, firstname: match.firstname, lastname: match.lastname }
				: currentBooking.trainer;
			currentBooking = {
				...currentBooking,
				trainer,
				booking: {
					...currentBooking.booking,
					updatedAt
				}
			};
		} else if (field === 'location') {
			const locationList = get(locations) ?? [];
			const match = locationList.find((loc) => loc.id === value.locationId);
			const location = match
				? { id: match.id, name: match.name, color: match.color ?? '' }
				: currentBooking.location;
			currentBooking = {
				...currentBooking,
				location,
				booking: {
					...currentBooking.booking,
					updatedAt
				}
			};
		} else if (field === 'time') {
			const originalStart = new Date(currentBooking.booking.startTime);
			const originalEnd = currentBooking.booking.endTime
				? new Date(currentBooking.booking.endTime)
				: new Date(originalStart.getTime() + 60 * 60 * 1000);
			const duration = originalEnd.getTime() - originalStart.getTime();

			const newStart = new Date(`${value.date}T${value.time}:00`);
			const newEnd = new Date(newStart.getTime() + duration);
			currentBooking = {
				...currentBooking,
				booking: {
					...currentBooking.booking,
					startTime: newStart.toISOString(),
					endTime: newEnd.toISOString(),
					updatedAt
				}
			};
		}
	}

	async function handleQuickSave(field: QuickEditField, value: Record<string, any>) {
		if (!field || quickEditSavingField) return;

		const payloadOverrides: Record<string, any> = {};
		if (field === 'trainer') {
			payloadOverrides.trainerId = Number(value.trainerId);
			if (Number(payloadOverrides.trainerId) === currentTrainerId) {
				resetQuickEditState();
				return;
			}
		} else if (field === 'location') {
			payloadOverrides.locationId = Number(value.locationId);
			if (Number(payloadOverrides.locationId) === currentLocationId) {
				resetQuickEditState();
				return;
			}
		} else if (field === 'time') {
			payloadOverrides.date = value.date;
			payloadOverrides.time = value.time;
			if (
				payloadOverrides.time === currentBookingTime &&
				payloadOverrides.date === currentBookingDate
			) {
				resetQuickEditState();
				return;
			}
		}

		const payload = buildQuickEditPayload(payloadOverrides);
		quickEditSavingField = field;

		try {
			const result = await updateStandardBooking(payload);
			if (!result.success) {
				throw new Error(result.message ?? 'Bokningen kunde inte uppdateras.');
			}

			applyLocalQuickEdit(field, payloadOverrides);
			await calendarStore.refresh(fetch);
			dispatch('updated', { booking: currentBooking });
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Bokning uppdaterad',
				description: 'Ändringen sparades.'
			});
			resetQuickEditState();
		} catch (error: any) {
			console.error('Quick edit update failed', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Uppdatering misslyckades',
				description: error?.message ?? 'Försök igen eller öppna redigeraren.'
			});
			quickEditSavingField = null;
		}
	}

	function handleTrainerChange(event: CustomEvent<{ value: number }>) {
		const trainerId = Number(event.detail?.value ?? pendingTrainerSelection);
		pendingTrainerSelection = trainerId;
		if (Number.isFinite(trainerId)) {
			void handleQuickSave('trainer', { trainerId });
		}
	}

	function handleLocationChange(event: CustomEvent<{ value: number }>) {
		const locationId = Number(event.detail?.value ?? pendingLocationSelection);
		pendingLocationSelection = locationId;
		if (Number.isFinite(locationId)) {
			void handleQuickSave('location', { locationId });
		}
	}

	function handleTimeSelect(event: CustomEvent<string>) {
		const timeValue = event.detail;
		quickEditTime = timeValue;
		if (!timeValue) return;
		void handleQuickSave('time', { date: quickEditDate, time: timeValue });
	}

	function closeQuickEdit() {
		resetQuickEditState();
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
	<div class="flex w-full max-w-full flex-col gap-4 bg-white">
		<div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div>
				{#if bookingTypeLabel}
					<span
						class="bg-gray inline-flex items-center rounded-sm px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase"
					>
						{bookingTypeLabel}
					</span>
				{/if}
			</div>

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
			<div class="mx-1 rounded-sm border border-rose-300 bg-rose-100 p-3 text-rose-900">
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
				<div class="space-y-5 rounded-sm border border-gray-100 bg-gray-50 p-5 text-gray-700">
					<div>
						<p class="text-xs font-semibold tracking-wide text-gray-500 uppercase">Namn</p>
						<p class="mt-1 text-base font-semibold text-gray-900">
							{currentBooking.personalBooking?.name ?? 'Ej angivet'}
						</p>
					</div>
					{#if currentBooking.personalBooking?.text}
						<div>
							<p class="text-xs font-semibold tracking-wide text-gray-500 uppercase">Beskrivning</p>
							<p class="mt-1 text-sm text-gray-800">{currentBooking.personalBooking?.text}</p>
						</div>
					{/if}
					<div>
						<p class="text-xs font-semibold tracking-wide text-gray-500 uppercase">Deltagare</p>
						{#if participantNames.length > 0}
							<ul class="mt-1 ml-4 list-disc text-sm text-gray-700">
								{#each participantNames as name}
									<li>{name}</li>
								{/each}
							</ul>
						{:else}
							<p class="mt-1 text-sm text-gray-800">Inga deltagare angivna.</p>
						{/if}
					</div>
				</div>
			{:else}
				<div class="space-y-5 rounded-sm border border-gray-100 bg-gray-50 p-5 text-gray-700">
					<div>
						<div
							class="flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-500 uppercase"
						>
							<Icon icon="Clients" size="16px" />
							<span>{participantLabel}</span>
						</div>
						<div class="mt-1 text-base font-semibold text-gray-900">
							{#if participantEntry?.id}
								{#if showTraineeParticipant}
									<a
										class="text-orange hover:underline"
										href={`/users/${participantEntry.id}`}
										on:click={onClose}
									>
										{participantEntry.firstname}
										{participantEntry.lastname}
									</a>
								{:else}
									<a
										class="text-orange hover:underline"
										href={`/clients/${participantEntry.id}`}
										on:click={onClose}
									>
										{participantEntry.firstname}
										{participantEntry.lastname}
									</a>
								{/if}
							{:else}
								<span>{showTraineeParticipant ? 'Trainee saknas' : 'Kund saknas'}</span>
							{/if}
						</div>
					</div>

					<div>
						<div class="flex items-center gap-2">
							<div
								class="flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-500 uppercase"
							>
								<Icon icon="Person" size="16px" />
								<span>Tränare</span>
							</div>
							{#if canQuickSwap}
								<Button
									icon="Swap"
									variant="tertiary"
									small
									on:click={() => toggleQuickEdit('trainer')}
									aria-label="Byt tränare"
								/>
							{/if}
						</div>
						{#if activeQuickEdit !== 'trainer'}
							<div class="mt-1 text-base font-semibold text-gray-900">
								{#if currentBooking.trainer?.id}
									<a
										class="text-orange hover:underline"
										href={`/users/${currentBooking.trainer?.id}`}
										on:click={onClose}
									>
										{currentBooking.trainer?.firstname}
										{currentBooking.trainer?.lastname}
									</a>
								{:else}
									<span>Saknas</span>
								{/if}
							</div>
						{/if}
						{#if activeQuickEdit === 'trainer'}
							<div class="mt-2 rounded-sm border border-gray-200 bg-white p-3">
								{#if quickEditOptionsLoading}
									<div class="flex items-center gap-2 text-sm text-gray-500">
										<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
											<circle
												class="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												stroke-width="4"
											/>
											<path
												class="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
											/>
										</svg>
										Hämtar lediga tränare...
									</div>
								{:else}
									<Dropdown
										id="quick-trainer"
										label="Välj tränare"
										placeholder="Välj tränare"
										options={trainerSwapOptions}
										bind:selectedValue={pendingTrainerSelection}
										on:change={handleTrainerChange}
										search={trainerSwapOptions.length > 8}
									/>
									<div class="mt-2 flex justify-end">
										<Button text="Avbryt" variant="secondary" small on:click={closeQuickEdit} />
									</div>
								{/if}
								{#if quickEditSavingField === 'trainer'}
									<div class="mt-2 flex items-center gap-2 text-xs text-gray-500">
										<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
											<circle
												class="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												stroke-width="4"
											/>
											<path
												class="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
											/>
										</svg>
										Sparar ändringen...
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<div>
						<div class="flex items-center gap-2">
							<div
								class="flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-500 uppercase"
							>
								<Icon icon="Building" size="16px" />
								<span>Plats</span>
							</div>
							{#if canQuickSwap}
								<Button
									icon="Swap"
									variant="tertiary"
									small
									on:click={() => toggleQuickEdit('location')}
									aria-label="Byt plats"
								/>
							{/if}
						</div>
						{#if activeQuickEdit !== 'location'}
							<div class="mt-1 text-base font-semibold text-gray-900">
								{currentBooking.location?.name ?? 'Saknas'}
							</div>
						{/if}
						{#if activeQuickEdit === 'location'}
							<div class="mt-2 rounded-sm border border-gray-200 bg-white p-3">
								{#if quickEditOptionsLoading}
									<div class="flex items-center gap-2 text-sm text-gray-500">
										<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
											<circle
												class="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												stroke-width="4"
											/>
											<path
												class="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
											/>
										</svg>
										Hämtar lediga platser...
									</div>
								{:else}
									<Dropdown
										id="quick-location"
										label="Välj plats"
										placeholder="Välj plats"
										options={locationSwapOptions}
										bind:selectedValue={pendingLocationSelection}
										on:change={handleLocationChange}
										search={locationSwapOptions.length > 8}
									/>
									<div class="mt-2 flex justify-end">
										<Button text="Avbryt" variant="secondary" small on:click={closeQuickEdit} />
									</div>
								{/if}
								{#if quickEditSavingField === 'location'}
									<div class="mt-2 flex items-center gap-2 text-xs text-gray-500">
										<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
											<circle
												class="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												stroke-width="4"
											/>
											<path
												class="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
											/>
										</svg>
										Sparar ändringen...
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<div
				class={`mt-6 space-y-2 rounded-sm border border-gray-100 bg-gray-50 p-5 text-gray-700 ${isCancelled ? 'line-through' : ''}`}
			>
				<div class="flex items-center gap-2">
					<div
						class="flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-500 uppercase"
					>
						<Icon icon="Clock" size="16px" />
						<span>Tid</span>
					</div>
					{#if canQuickSwap}
						<Button
							icon="Swap"
							variant="tertiary"
							small
							on:click={() => toggleQuickEdit('time')}
							aria-label="Byt tid"
						/>
					{/if}
				</div>
				{#if activeQuickEdit !== 'time'}
					<p class="text-base font-semibold text-gray-900">
						{formatTime(startTime.toISOString())} – {formatTime(endTime.toISOString())}
					</p>
				{/if}

				{#if activeQuickEdit === 'time'}
					<div class="rounded-sm border border-gray-200 bg-white p-3">
						{#if currentTrainerId && currentLocationId}
							<SlotTimePicker
								bind:selectedDate={quickEditDate}
								bind:selectedTime={quickEditTime}
								trainerId={currentTrainerId}
								locationId={currentLocationId}
								checkUsersBusy={shouldCheckTraineeConflicts()}
								traineeUserId={getTraineeUserId()}
								includeOutsideAvailability={false}
								bookingIdToIgnore={currentBooking.booking.id}
								on:timeSelect={handleTimeSelect}
								dateField="quickEditDate"
								timeField="quickEditTime"
							/>
						{:else}
							<p class="text-sm text-gray-600">Välj tränare och plats innan du ändrar tiden.</p>
						{/if}
						{#if quickEditSavingField === 'time'}
							<div class="mt-2 flex items-center gap-2 text-xs text-gray-500">
								<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
									<circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									/>
									<path
										class="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
									/>
								</svg>
								Sparar ändringen...
							</div>
						{/if}
						<div class="mt-2 flex justify-end">
							<Button text="Avbryt" variant="secondary" small on:click={closeQuickEdit} />
						</div>
					</div>
				{/if}
			</div>

			{#if currentBooking.booking.tryOut}
				<p class="font-semibold text-orange-600">Prova-på-bokning</p>
			{/if}
		</div>
	</div>
{/if}
