<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { get } from 'svelte/store';

	import BookingTraining from '../bookingPopup/bookingTraining/BookingTraining.svelte';
	import BookingPractice from '../bookingPopup/bookingPractice/BookingPractice.svelte';
	import BookingMeeting from '../bookingPopup/bookingMeeting/BookingMeeting.svelte';
	import Button from '../../bits/button/Button.svelte';
	import MailComponent from '../mailComponent/MailComponent.svelte';

	import type { FullBooking } from '$lib/types/calendarTypes';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { clients, fetchClients, getClientEmails } from '$lib/stores/clientsStore';
	import {
		bookingContents as bookingContentsStore,
		fetchBookingContents
	} from '$lib/stores/bookingContentStore';
	import { user } from '$lib/stores/userStore';
	import { calendarStore } from '$lib/stores/calendarStore';
	import { loadingStore } from '$lib/stores/loading';
	import { openPopup } from '$lib/stores/popupStore';
	import {
		handleBookingEmail,
		updateTrainingBooking,
		updateMeetingOrPersonalBooking
	} from '$lib/helpers/bookingHelpers/bookingHelpers';
	import { capitalizeFirstLetter } from '$lib/helpers/generic/genericHelpers';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import type { User } from '$lib/types/userTypes';

	declare function structuredClone<T>(value: T): T;

	type BookingComponentType =
		| 'training'
		| 'trial'
		| 'practice'
		| 'education'
		| 'flight'
		| 'meeting'
		| 'personal';

	type BookingTypeOption = { value: string | number; label: string };

	export let booking: FullBooking;
	export let bookingContentOptions: BookingTypeOption[] = [];

	const dispatch = createEventDispatcher();

	let selectedBookingComponent: BookingComponentType = 'training';
	let editableBooking: any = null;
	let repeatedBookings: any[] = [];
	let selectedIsUnavailable = false;
	let initialized = false;

	let typeOptions: BookingTypeOption[] = [];
	let currentUser = get(user);

	let allUsers: User[] = [];
	let activeUsers: User[] = [];
	let educatorIds = new Set<number>();
	let userOptions: { label: string; value: number }[] = [];
	let meetingUserOptions: { name: string; value: number }[] = [];
	let educationTrainerOptions: { label: string; value: number }[] = [];
	let locationOptions: { label: string; value: number }[] = [];
	let isAdminUser = false;
	let isEducatorUser = false;

	const componentLabels: Record<BookingComponentType, string> = {
		training: 'Träning',
		trial: 'Provträning',
		practice: 'Praktiktimme',
		education: 'Utbildning',
		flight: 'Flygtimme',
		meeting: 'Möte',
		personal: 'Personlig'
	};

	const standardTypes = new Set<BookingComponentType>([
		'training',
		'trial',
		'practice',
		'education',
		'flight'
	]);

	const EMAIL_DEFAULT = { value: 'none', label: 'Skicka inte' };
	const LOADING_MESSAGE = 'Uppdaterar bokning...';

	onMount(async () => {
		await Promise.all([fetchLocations(), fetchUsers(), fetchClients(), fetchBookingContents()]);
		currentUser = get(user);
		initializeIfReady();
	});

	$: typeOptions = bookingContentOptions.length
		? bookingContentOptions
		: ($bookingContentsStore || []).map((content) => ({
				value: content.id,
				label: capitalizeFirstLetter(content.kind)
			}));

	$: currentUser = $user;
	$: isAdminUser = hasRole('Administrator', currentUser);
	$: isEducatorUser = hasRole('Educator', currentUser);

	$: allUsers = ($users as User[] | undefined) ?? [];
	$: activeUsers = allUsers.filter((u) => u.active);
	$: userOptions = activeUsers.map((u) => ({ label: `${u.firstname} ${u.lastname}`, value: u.id }));
	$: meetingUserOptions = activeUsers.map((u) => ({
		name: `${u.firstname} ${u.lastname}`,
		value: u.id
	}));
	$: educatorIds = new Set(
		activeUsers.filter((candidate) => hasRole('Educator', candidate)).map((candidate) => candidate.id)
	);
	$: educationTrainerOptions = userOptions.filter((option) => educatorIds.has(option.value));
	$: locationOptions = ($locations || []).map((loc) => ({ label: loc.name, value: loc.id }));

	$: initializeIfReady();

	function initializeIfReady() {
		if (!initialized && booking && typeOptions.length) {
			selectedBookingComponent = determineType(booking);
			editableBooking = buildEditableBooking(booking, selectedBookingComponent);
			initialized = true;
		}
	}

	function determineType(full: FullBooking): BookingComponentType {
		if (full.isPersonalBooking) {
			const kind = full.personalBooking?.kind?.toLowerCase() ?? '';
			if (kind.includes('private') || kind === 'personal' || kind === 'privat') {
				return 'personal';
			}
			return 'meeting';
		}

		if (full.booking.tryOut) return 'trial';
		if (full.booking.internalEducation) return 'practice';
		if (full.additionalInfo?.education) return 'education';
		if (full.additionalInfo?.internal) return 'flight';
		return 'training';
	}

	function parseUserId(value: unknown): number | null {
		if (value === null || value === undefined) return null;
		if (typeof value === 'number') return value;
		if (typeof value === 'string') {
			const trimmed = value.replace(/[{}]/g, '').trim();
			if (!trimmed) return null;
			const first = Number(trimmed.split(',')[0]);
			return Number.isNaN(first) ? null : first;
		}
		return null;
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

	function deriveEndTime(start: Date, endTimeString?: string | null): string {
		if (endTimeString) {
			const parsed = new Date(endTimeString);
			if (!Number.isNaN(parsed.getTime())) {
				return toTimeInputValue(parsed);
			}
		}

		const fallback = new Date(start.getTime() + 60 * 60 * 1000);
		return toTimeInputValue(fallback);
	}

	function cloneFullBooking(source: FullBooking): FullBooking {
		return typeof structuredClone === 'function'
			? structuredClone(source)
			: JSON.parse(JSON.stringify(source));
	}

	function buildUpdatedFullBooking(
		payload: any,
		type: BookingComponentType,
		apiRecord?: any
	): FullBooking {
		const cloned = cloneFullBooking(booking);

		const startISO = apiRecord?.start_time ?? `${payload.date}T${payload.time}:00`;
		const startDate = new Date(startISO);
		cloned.booking.startTime = startDate.toISOString();
		cloned.booking.updatedAt = apiRecord?.updated_at
			? new Date(apiRecord.updated_at).toISOString()
			: new Date().toISOString();

		const endISO =
			apiRecord?.end_time ?? (payload.endTime ? `${payload.date}T${payload.endTime}:00` : null);
		cloned.booking.endTime = endISO ? new Date(endISO).toISOString() : null;
		cloned.booking.status = payload.status ?? cloned.booking.status;
		cloned.booking.userId = payload.user_id ?? cloned.booking.userId ?? null;

		if (standardTypes.has(type)) {
			cloned.booking.tryOut = !!payload.isTrial;
			cloned.booking.internalEducation = !!payload.internalEducation;
			if (!cloned.additionalInfo) {
				cloned.additionalInfo = {
					packageId: null,
					education: false,
					internal: false,
					bookingContent: { id: null, kind: '' },
					addedToPackageBy: null,
					addedToPackageDate: null,
					actualCancelTime: null
				};
			}
			cloned.additionalInfo.education = !!payload.education;
			cloned.additionalInfo.internal = !!payload.internal;
			if (!cloned.additionalInfo.bookingContent) {
				cloned.additionalInfo.bookingContent = { id: null, kind: '' };
			}
			if (payload.bookingType) {
				cloned.additionalInfo.bookingContent.id = payload.bookingType.value ?? null;
				const matchedOption = typeOptions.find((opt) => opt.value === payload.bookingType.value);
				cloned.additionalInfo.bookingContent.kind =
					matchedOption?.label ??
					payload.bookingType.label ??
					cloned.additionalInfo.bookingContent.kind;
			}

			const allUsers = get(users) ?? [];
			const trainer = allUsers.find((u) => u.id === payload.trainerId);
			cloned.trainer = trainer
				? { id: trainer.id, firstname: trainer.firstname, lastname: trainer.lastname }
				: null;

			const clientList = get(clients) ?? [];
			const client = clientList.find((c) => c.id === payload.clientId);
			cloned.client = client
				? { id: client.id ?? null, firstname: client.firstname, lastname: client.lastname }
				: null;

			const locationList = get(locations) ?? [];
			const loc = locationList.find((l) => l.id === payload.locationId);
			cloned.location = loc ? { id: loc.id, name: loc.name, color: loc.color } : null;

			const room = loc?.rooms?.find((r) => r.id === payload.roomId);
			cloned.room = room ? { id: room.id, name: room.name } : null;
		} else {
			const attendeeIds = payload.user_ids ?? payload.attendees ?? [];
			if (!cloned.personalBooking) {
				const original = booking.personalBooking;
				cloned.personalBooking = {
					name: original?.name ?? '',
					text: original?.text ?? '',
					bookedById: original?.bookedById ?? null,
					userIds: [],
					kind: original?.kind ?? (type === 'personal' ? 'Private' : 'Corporate')
				};
			}
			cloned.personalBooking.name = payload.name ?? cloned.personalBooking.name ?? '';
			cloned.personalBooking.text = payload.text ?? cloned.personalBooking.text ?? '';
			cloned.personalBooking.userIds = attendeeIds;
			cloned.personalBooking.kind = payload.kind ?? cloned.personalBooking.kind ?? 'Corporate';
			cloned.booking.userId = payload.user_id ?? (attendeeIds.length ? attendeeIds[0] : null);

			const locationList = get(locations) ?? [];
			const loc = locationList.find((l) => l.id === payload.locationId);
			cloned.location = loc ? { id: loc.id, name: loc.name, color: loc.color } : null;

			cloned.trainer = null;
			cloned.client = null;
			cloned.room = null;
		}

		return cloned;
	}

	function buildEditableBooking(full: FullBooking, type: BookingComponentType) {
		const start = new Date(full.booking.startTime);
		const date = toDateInputValue(start);
		const time = toTimeInputValue(start);
		const originalEndTime = full.booking.endTime ?? null;
		const endTime = originalEndTime
			? toTimeInputValue(new Date(originalEndTime))
			: deriveEndTime(start, null);

		const base = {
			id: full.booking.id,
			date,
			time,
			endTime,
			__originalEndTime: originalEndTime,
			status: full.booking.status,
			repeat: false,
			repeatWeeks: 4,
			emailBehavior: { ...EMAIL_DEFAULT }
		};

		if (standardTypes.has(type)) {
			const bookingContentId = full.additionalInfo?.bookingContent?.id ?? null;
			const bookingContentLabel = full.additionalInfo?.bookingContent?.kind ?? 'Okänd';
			const bookingTypeOption =
				bookingContentId !== null
					? (typeOptions.find((opt) => opt.value === bookingContentId) ?? {
							value: bookingContentId,
							label: capitalizeFirstLetter(bookingContentLabel)
						})
					: null;

			return {
				...base,
				trainerId: full.trainer?.id ?? null,
				clientId: full.client?.id ?? null,
				locationId: full.location?.id ?? null,
				roomId: full.room?.id ?? null,
				bookingType: bookingTypeOption,
				isTrial: full.booking.tryOut,
				internalEducation: full.booking.internalEducation,
				internal: full.additionalInfo?.internal ?? false,
				education: full.additionalInfo?.education ?? false,
				user_id: parseUserId(full.booking.userId),
				attendees: []
			};
		}

		const attendees = full.personalBooking?.userIds ?? [];

		return {
			...base,
			name: full.personalBooking?.name ?? '',
			text: full.personalBooking?.text ?? '',
			user_id: attendees[0] ?? null,
			user_ids: [...attendees],
			attendees: [...attendees],
			locationId: full.location?.id ?? null,
			kind: full.personalBooking?.kind ?? (type === 'personal' ? 'Private' : 'Corporate')
		};
	}

	function ensureFlagsForType(type: BookingComponentType, payload: any) {
		payload.isTrial = type === 'trial';
		payload.internal = type === 'flight';
		payload.internalEducation = type === 'practice';
		payload.education = type === 'education';

		if (type === 'practice' || type === 'education' || type === 'flight') {
			payload.clientId = null;
		}
	}

	function getPersonalKind(type: BookingComponentType, fallback?: string | null) {
		if (type === 'personal') return 'Private';
		if (fallback && fallback.trim().length > 0) return fallback;
		return 'Corporate';
	}

	function getLocationLabelFromId(id: number | null | undefined) {
		const list = get(locations) ?? [];
		const loc = id ? list.find((l) => l.id === id) : null;
		return loc?.name ?? 'Okänd plats';
	}

	function validateForm(): boolean {
		if (!editableBooking) return false;

		if (standardTypes.has(selectedBookingComponent)) {
			if (!editableBooking.trainerId) {
				addToast({
					type: AppToastType.CANCEL,
					message: 'Saknar tränare',
					description: 'Välj en tränare innan du sparar ändringarna.'
				});
				return false;
			}

			if (!editableBooking.date || !editableBooking.time) {
				addToast({
					type: AppToastType.CANCEL,
					message: 'Ofullständig tid',
					description: 'Ange datum och starttid för bokningen.'
				});
				return false;
			}

			if (
				(selectedBookingComponent === 'practice' || selectedBookingComponent === 'education') &&
				!editableBooking.user_id
			) {
				addToast({
					type: AppToastType.CANCEL,
					message: 'Saknar deltagare',
					description: 'Välj användare för denna bokning innan du sparar.'
				});
				return false;
			}
		} else {
			if (!editableBooking.name?.trim()) {
				addToast({
					type: AppToastType.CANCEL,
					message: 'Namn saknas',
					description: 'Ange ett namn för bokningen.'
				});
				return false;
			}

			if (!editableBooking.date || !editableBooking.time || !editableBooking.endTime) {
				addToast({
					type: AppToastType.CANCEL,
					message: 'Ofullständig tid',
					description: 'Ange datum, starttid och sluttid för bokningen.'
				});
				return false;
			}
		}

		return true;
	}

	function preparePayload(): any {
		const payload = JSON.parse(JSON.stringify(editableBooking));
		payload.user_id =
			payload.user_id !== null && payload.user_id !== undefined ? Number(payload.user_id) : null;
		payload.roomId =
			payload.roomId !== null && payload.roomId !== undefined ? Number(payload.roomId) : null;
		payload.trainerId =
			payload.trainerId !== null && payload.trainerId !== undefined
				? Number(payload.trainerId)
				: null;
		payload.clientId =
			payload.clientId !== null && payload.clientId !== undefined ? Number(payload.clientId) : null;
		payload.locationId =
			payload.locationId !== null && payload.locationId !== undefined
				? Number(payload.locationId)
				: null;
		if (payload.bookingType && payload.bookingType.value !== undefined) {
			const numericValue = Number(payload.bookingType.value);
			payload.bookingType.value = Number.isNaN(numericValue)
				? payload.bookingType.value
				: numericValue;
		}
		payload.emailBehavior = editableBooking.emailBehavior ?? { ...EMAIL_DEFAULT };

		if (standardTypes.has(selectedBookingComponent) && !payload.__originalEndTime) {
			payload.endTime = null;
		}

		delete payload.__originalEndTime;
		return payload;
	}

	async function maybeSendEmail(type: BookingComponentType, payload: any) {
		if (!standardTypes.has(type)) return;

		const behavior = payload.emailBehavior?.value ?? 'none';
		if (behavior === 'none') return;
		if (!payload.clientId) return;

		const clientEmail = getClientEmails(payload.clientId);
		if (!clientEmail) return;

		const bookedDates = [
			{
				date: payload.date,
				time: payload.time,
				locationName: getLocationLabelFromId(payload.locationId)
			}
		];

		const emailResult = await handleBookingEmail({
			emailBehavior: behavior,
			clientEmail,
			fromUser: currentUser,
			bookedDates
		});

		if (emailResult === 'edit') {
			openEmailPopup(clientEmail, bookedDates);
		}
	}

	function openEmailPopup(
		recipient: string,
		bookedDates: { date: string; time: string; locationName?: string }[]
	) {
		const locationsSummary = bookedDates
			.map((b) => `${b.date} kl. ${b.time}${b.locationName ? ` på ${b.locationName}` : ''}`)
			.join('<br>');

		openPopup({
			header: `Maila bokningsuppdatering till ${recipient}`,
			icon: 'Mail',
			component: MailComponent,
			maxWidth: '900px',
			props: {
				prefilledRecipients: [recipient],
				subject: 'Bokningsuppdatering',
				header: 'Din bokning har uppdaterats',
				subheader: 'Nya detaljer för din bokning',
				body: `
			Hej!<br><br>
			Följande bokning har uppdaterats:<br>
			${locationsSummary}<br><br>
			Kontakta oss om något inte stämmer.<br><br>
			Hälsningar,<br>
			${currentUser?.firstname ?? ''}<br>
			Takkei Trainingsystems
		`,
				lockedFields: ['recipients'],
				autoFetchUsersAndClients: false
			}
		});
	}

	async function handleUpdate() {
		if (!editableBooking) return;
		if (!validateForm()) return;

		const payload = preparePayload();
		ensureFlagsForType(selectedBookingComponent, payload);

		if (selectedBookingComponent === 'personal' || selectedBookingComponent === 'meeting') {
			payload.kind = getPersonalKind(selectedBookingComponent, booking.personalBooking?.kind);
		}

		loadingStore.loading(true, LOADING_MESSAGE);
		let success = false;
		let updatedFullBooking: FullBooking | null = null;

		try {
			if (standardTypes.has(selectedBookingComponent)) {
				const result = await updateTrainingBooking(payload);
				success = result.success;
				if (success) {
					updatedFullBooking = buildUpdatedFullBooking(
						payload,
						selectedBookingComponent,
						result.booking
					);
				}
			} else {
				const result = await updateMeetingOrPersonalBooking(
					payload,
					selectedBookingComponent,
					payload.kind
				);
				success = result.success;
				if (success) {
					updatedFullBooking = buildUpdatedFullBooking(
						payload,
						selectedBookingComponent,
						result.booking
					);
				}
			}

			if (success && updatedFullBooking) {
				await maybeSendEmail(selectedBookingComponent, payload);
				calendarStore.refresh(fetch);
				dispatch('close', { booking: updatedFullBooking });
			}
		} finally {
			loadingStore.loading(false);
		}
	}

	function closeEditor() {
		dispatch('close');
	}

	function handleUnavailabilityChange(event: CustomEvent<boolean>) {
		selectedIsUnavailable = event.detail;
	}

	function isSaveDisabled() {
		return !editableBooking || $loadingStore.isLoading;
	}
</script>

<div
	class="border-gray-bright bg-gray-bright/10 flex w-[600px] flex-col gap-6 rounded-sm border border-dashed p-6"
>
	<div class="flex items-center justify-between">
		<h2 class="text-xl font-semibold">Redigera bokning</h2>
		<span
			class="bg-gray rounded-sm px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase"
		>
			{componentLabels[selectedBookingComponent]}
		</span>
	</div>

	{#if editableBooking}
		{#if selectedBookingComponent === 'training' || selectedBookingComponent === 'trial' || selectedBookingComponent === 'flight'}
			<BookingTraining
				bind:bookingObject={editableBooking}
				bind:repeatedBookings
				bind:selectedIsUnavailable
				bookingContents={typeOptions}
				isTrial={selectedBookingComponent === 'trial'}
				isFlight={selectedBookingComponent === 'flight'}
				isEditing
				on:unavailabilityChange={handleUnavailabilityChange}
			/>
		{:else if selectedBookingComponent === 'practice' || selectedBookingComponent === 'education'}
			<BookingPractice
				bind:bookingObject={editableBooking}
				bind:repeatedBookings
				bind:selectedIsUnavailable
				kind={selectedBookingComponent === 'education' ? 'education' : 'practice'}
				locations={locationOptions}
				users={userOptions}
				trainerOptions={selectedBookingComponent === 'education'
					? educationTrainerOptions
					: userOptions}
				isEditing
				on:unavailabilityChange={handleUnavailabilityChange}
			/>
		{:else}
			<BookingMeeting
				bind:bookingObject={editableBooking}
				bind:repeatedBookings
				bind:selectedIsUnavailable
				users={meetingUserOptions}
				isMeeting={selectedBookingComponent === 'meeting'}
				isEditing
				on:unavailabilityChange={handleUnavailabilityChange}
			/>
		{/if}

		<div class="mt-4 flex justify-end gap-3">
			<Button
				text="Avbryt"
				variant="secondary"
				on:click={closeEditor}
				disabled={$loadingStore.isLoading}
			/>

			{#if selectedIsUnavailable}
				<Button
					text="Spara ändringar"
					variant="primary"
					iconLeft="CalendarCheck"
					iconLeftSize="18px"
					confirmOptions={{
						title: 'Är du säker?',
						description:
							'Den valda tiden ligger utanför tränarens schema. Vill du spara ändringarna ändå?',
						action: handleUpdate
					}}
					disabled={isSaveDisabled()}
				/>
			{:else}
				<Button
					text="Spara ändringar"
					variant="primary"
					iconLeft="CalendarCheck"
					iconLeftSize="18px"
					on:click={handleUpdate}
					disabled={isSaveDisabled()}
				/>
			{/if}
		</div>
	{:else}
		<p class="text-gray text-sm">Laddar bokningsinformation...</p>
	{/if}
</div>
