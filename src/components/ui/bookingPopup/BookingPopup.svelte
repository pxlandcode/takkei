<script lang="ts">
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import { clients, fetchClients, getClientEmails } from '$lib/stores/clientsStore';
	import { bookingContents, fetchBookingContents } from '$lib/stores/bookingContentStore';
	import { capitalizeFirstLetter } from '$lib/helpers/generic/genericHelpers';
	import Button from '../../bits/button/Button.svelte';
	import BookingTraining from './bookingTraining/BookingTraining.svelte';
	import BookingPractice from './bookingPractice/BookingPractice.svelte';
	import BookingMeeting from './bookingMeeting/BookingMeeting.svelte';
	import OptionsSelect from '../../bits/options-select/OptionsSelect.svelte';
	import { user } from '$lib/stores/userStore';
	import { calendarStore } from '$lib/stores/calendarStore';
	import { get } from 'svelte/store';
	import {
		BOOKING_EMAIL_RECIPIENT_DEFAULT,
		buildBookingConfirmationEmailBody,
		buildMeetingConfirmationEmailBody,
		handleBookingEmail,
		handleMeetingBookingEmail,
		handleMeetingOrPersonalBooking,
		handleTrainingBooking,
		MEETING_CONFIRMATION_EMAIL_HEADER,
		MEETING_CONFIRMATION_EMAIL_SUBHEADER,
		MEETING_CONFIRMATION_EMAIL_SUBJECT,
		requireClientCalendarEmailLinks,
		resolveBookingConfirmationRecipients,
		resolveMeetingConfirmationRecipients,
		type BookedDateLine,
		type BookingEmailRecipientTarget,
		type ClientCalendarEmailLinks
	} from '$lib/helpers/bookingHelpers/bookingHelpers';
	import { openPopup, popupStore, closePopup, type PopupState } from '$lib/stores/popupStore';
	import MailComponent from '../mailComponent/MailComponent.svelte';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import type { AuthenticatedUser, User } from '$lib/types/userTypes';
	import type { SelectedSlot } from '$lib/stores/selectedSlotStore';
	import { clearSelectedSlot } from '$lib/stores/selectedSlotStore';
	import { loadingStore } from '$lib/stores/loading';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';

	export let startTime: Date | null = null;
	export let clientId: number | null = null;
	export let trainerId: number | null = null;
	export let resumeSlot: SelectedSlot | null = null;

	const dispatch = createEventDispatcher();
	const popupInstance: PopupState | null = get(popupStore);

	function onClose() {
		calendarStore.refresh(fetch);
		dispatch('close');
		if (get(popupStore) === popupInstance) {
			closePopup();
		}
	}

	type BookingComponent =
		| 'training'
		| 'meeting'
		| 'personal'
		| 'trial'
		| 'practice'
		| 'flight'
		| 'education';

	type UserOption = { label: string; value: number };
	type MeetingUserOption = { name: string; value: number };
	type BookingTypeOption = { label: string; value: string | number; icon?: string | null };
	type EmailBehavior = 'send' | 'edit' | 'none';
	type EmailBehaviorOption = { label: string; value: EmailBehavior };
	type BookingObjectState = {
		user_id: number | null;
		booked_by_id: number | null;
		user_ids: number[];
		attendees: number[];
		bookingType: BookingTypeOption | null;
		trainerId: number | null;
		clientId: number | null;
		locationId: number | null;
		roomId?: number | null;
		currentUser: AuthenticatedUser | null;
		isTrial: boolean;
		internalEducation: boolean;
		education: boolean;
		internal: boolean;
		name: string;
		text: string;
		date: string;
		time: string;
		endTime: string;
		repeat: boolean;
		repeatWeeks?: number;
		emailBehavior: EmailBehaviorOption;
		emailRecipient: { value: BookingEmailRecipientTarget; label: string };
	};

	const BOOKING_TYPE_OPTIONS: { label: string; icon: string; value: BookingComponent }[] = [
		{ label: 'Träning', icon: 'Training', value: 'training' },
		{ label: 'Provträning', icon: 'ShiningStar', value: 'trial' },
		{ label: 'Praktiktimme', icon: 'Wrench', value: 'practice' },
		{ label: 'Utbildning', icon: 'GraduationCap', value: 'education' },
		{ label: 'Flygtimme', icon: 'Plane', value: 'flight' },
		{ label: 'Möte', icon: 'Meeting', value: 'meeting' },
		{ label: 'Personlig', icon: 'Person', value: 'personal' }
	];
	const EMAIL_BEHAVIOR_DEFAULT: EmailBehaviorOption = { label: 'Skicka inte', value: 'none' };
	const STANDARD_EMAIL_BOOKING_TYPES = new Set<BookingComponent>([
		'training',
		'trial',
		'practice',
		'flight',
		'education'
	]);

	let selectedBookingComponent: BookingComponent = 'training';

	let repeatedBookings: any[] = [];
	let selectedIsUnavailable = false;
	let currentUser: AuthenticatedUser | null = get(user);
	let formErrors: Record<string, string> = {};
	let previousComponent: BookingComponent | null = null;
	let resumeSlotApplied = false;
	let isApplyingResumeSlot = false;
	let isSubmitting = false;

	let allUsers: User[] = [];
	let activeUsers: User[] = [];
	let userOptions: UserOption[] = [];
	let educationTrainerOptions: UserOption[] = [];
	let meetingUserOptions: MeetingUserOption[] = [];
	let visibleBookingTypeOptions = BOOKING_TYPE_OPTIONS;
	let canAccessEducation = false;
	let isAdminUser = false;
	let isEducatorUser = false;
	let educatorIds = new Set<number>();

	let bookingObject: BookingObjectState = {
		user_id: null,
		booked_by_id: null,
		user_ids: [],
		attendees: [],
		bookingType: null,
		trainerId: null,
		clientId: null,
		locationId: null,
		currentUser: null,
		isTrial: false,
		internalEducation: false,
		education: false,
		internal: false,
		name: '',
		text: '',
		date: startTime
			? startTime.toISOString().split('T')[0]
			: new Date().toISOString().split('T')[0],
		time: startTime
			? startTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', hour12: false })
			: '12:30',
		endTime: startTime
			? new Date(startTime.getTime() + 60 * 60 * 1000).toLocaleTimeString('sv-SE', {
					hour: '2-digit',
					minute: '2-digit',
					hour12: false
				})
			: '13:30',
		repeat: false,
		emailBehavior: { ...EMAIL_BEHAVIOR_DEFAULT },
		emailRecipient: { ...BOOKING_EMAIL_RECIPIENT_DEFAULT }
	};

	function removeError(field: string) {
		if (formErrors[field]) {
			const { [field]: _removed, ...rest } = formErrors;
			formErrors = rest;
		}
	}

	function maybeClearError(field: string, condition: boolean) {
		if (condition && formErrors[field]) {
			removeError(field);
		}
	}

	function isValidEndTime(): boolean {
		if (!bookingObject.endTime || !bookingObject.time) return !!bookingObject.endTime;
		return bookingObject.endTime > bookingObject.time;
	}

	function validateBooking(
		type: 'training' | 'meeting' | 'personal' | 'trial' | 'practice' | 'flight' | 'education'
	): Record<string, string> {
		const errors: Record<string, string> = {};

		const hasDate = !!bookingObject.date;
		const hasTime = !!bookingObject.time;

		if (type === 'training' || type === 'trial' || type === 'flight') {
			if (!bookingObject.trainerId) errors.users = 'Välj en tränare.';
			if ((type === 'training' || type === 'trial') && !bookingObject.clientId)
				errors.clients = 'Välj en klient.';
			if (!bookingObject.locationId) errors.locations = 'Välj en plats.';
			if (type !== 'flight' && !bookingObject.bookingType?.value)
				errors.bookingType = 'Välj ett innehåll.';
			if (!hasDate) errors.date = 'Välj ett datum.';
			if (!hasTime) errors.time = 'Välj en tid.';
		}

		if (type === 'practice' || type === 'education') {
			if (!bookingObject.trainerId) errors.trainer = 'Välj en tränare.';
			if (type === 'practice' && !bookingObject.user_id) errors.trainee = 'Välj en trainee.';
			if (!bookingObject.locationId) errors.locations = 'Välj en plats.';
			if (!hasDate) errors.date = 'Välj ett datum.';
			if (!hasTime) errors.time = 'Välj en tid.';
		}

		if (type === 'meeting' || type === 'personal') {
			if (type === 'meeting') {
				if (!bookingObject.name?.trim()) errors.name = 'Ange ett namn för bokningen.';
				if (!bookingObject.attendees || bookingObject.attendees.length === 0)
					errors.attendees = 'Välj minst en deltagare.';
			} else if (!bookingObject.user_id) {
				errors.attendees = 'Ange vem bokningen gäller.';
			}

			if (!hasDate) errors.date = 'Välj ett datum.';
			if (!hasTime) errors.time = 'Välj en starttid.';

			if (!bookingObject.endTime) {
				errors.endTime = 'Ange en sluttid.';
			} else if (bookingObject.time && bookingObject.endTime <= bookingObject.time) {
				errors.endTime = 'Sluttiden måste vara efter starttiden.';
			}
		}

		return errors;
	}

	$: currentUser = $user;
	$: isAdminUser = hasRole('Administrator', currentUser?.kind === 'trainer' ? currentUser : null);
	$: isEducatorUser = hasRole('Educator', currentUser?.kind === 'trainer' ? currentUser : null);
	$: canAccessEducation = isAdminUser || isEducatorUser;

	$: allUsers = ($users as User[] | undefined) ?? [];
	$: activeUsers = allUsers.filter((u) => u.active);
	$: userOptions = activeUsers.map((u) => ({ label: `${u.firstname} ${u.lastname}`, value: u.id }));
	$: meetingUserOptions = activeUsers.map((u) => ({
		name: `${u.firstname} ${u.lastname}`,
		value: u.id
	}));
	$: educatorIds = new Set(
		activeUsers
			.filter((candidate) => hasRole('Educator', candidate))
			.map((candidate) => candidate.id)
	);
	$: educationTrainerOptions = userOptions.filter((option) => educatorIds.has(option.value));

	$: visibleBookingTypeOptions = BOOKING_TYPE_OPTIONS.filter(
		(option) => option.value !== 'education' || canAccessEducation
	);

	$: if (!canAccessEducation && selectedBookingComponent === 'education') {
		selectedBookingComponent = 'training';
	}

	$: if (resumeSlot && !resumeSlotApplied) {
		applyResumeSlot(resumeSlot);
	}

	// Reactive booking type fallback
	$: if (!isApplyingResumeSlot) {
		if (selectedBookingComponent === 'personal') {
			bookingObject.bookingType = { label: 'Privat', value: 'Private' };
			bookingObject.isTrial = false;
			bookingObject.internalEducation = false;
			bookingObject.education = false;
			bookingObject.user_id = null;
			bookingObject.clientId = null;
			bookingObject.internal = false;
			bookingObject.attendees = [];
			bookingObject.user_ids = [];
		} else if (selectedBookingComponent === 'meeting') {
			bookingObject.bookingType = { label: 'Möte', value: 'Meeting' };
			bookingObject.isTrial = false;
			bookingObject.internalEducation = false;
			bookingObject.education = false;
			bookingObject.user_id = null;
			bookingObject.clientId = null;
			bookingObject.internal = false;
		} else if (selectedBookingComponent === 'trial') {
			bookingObject.bookingType = null;
			bookingObject.isTrial = true;
			bookingObject.internalEducation = false;
			bookingObject.education = false;
			bookingObject.user_id = null;
			bookingObject.internal = false;
			bookingObject.attendees = [];
			bookingObject.user_ids = [];
		} else if (selectedBookingComponent === 'practice') {
			bookingObject.bookingType = { label: 'Praktiktimme', value: 'Practice' };
			bookingObject.isTrial = false;
			bookingObject.internalEducation = true;
			bookingObject.education = false;
			bookingObject.clientId = null;
			bookingObject.internal = false;
			bookingObject.attendees = [];
			bookingObject.user_ids = [];
		} else if (selectedBookingComponent === 'flight') {
			bookingObject.bookingType = null;
			bookingObject.isTrial = false;
			bookingObject.internal = true;
			bookingObject.internalEducation = false;
			bookingObject.education = false;
			bookingObject.repeat = false;
			bookingObject.attendees = [];
			bookingObject.user_ids = [];
		} else if (selectedBookingComponent === 'education') {
			bookingObject.bookingType = { label: 'Utbildningstimme', value: 'Education' };
			bookingObject.isTrial = false;
			bookingObject.internalEducation = false;
			bookingObject.education = true;
			bookingObject.clientId = null;
			bookingObject.user_id = null;
			bookingObject.internal = false;
			bookingObject.attendees = [];
			bookingObject.user_ids = [];
		} else {
			bookingObject.isTrial = false;
			bookingObject.internalEducation = false;
			bookingObject.education = false;
			bookingObject.user_id = null;
			bookingObject.internal = false;
			bookingObject.attendees = [];
			bookingObject.user_ids = [];
		}
	}

	// Sync user_ids and user_id from attendees
	$: if (selectedBookingComponent !== previousComponent) {
		formErrors = {};
		if (previousComponent !== null) {
			bookingObject.emailBehavior = { ...EMAIL_BEHAVIOR_DEFAULT };
			bookingObject.emailRecipient = { ...BOOKING_EMAIL_RECIPIENT_DEFAULT };
		}
		previousComponent = selectedBookingComponent;
	}

	$: maybeClearError('users', !!bookingObject.trainerId);
	$: maybeClearError('trainer', !!bookingObject.trainerId);
	$: maybeClearError('clients', !!bookingObject.clientId);
	$: maybeClearError('locations', !!bookingObject.locationId);
	$: maybeClearError('bookingType', !!bookingObject.bookingType?.value);
	$: maybeClearError('date', !!bookingObject.date);
	$: maybeClearError('time', !!bookingObject.time);
	$: maybeClearError('trainee', !!bookingObject.user_id);
	$: maybeClearError('attendees', !!bookingObject.attendees && bookingObject.attendees.length > 0);
	$: maybeClearError('name', !!bookingObject.name?.trim());
	$: maybeClearError('endTime', isValidEndTime());

	// Load initial data
	onMount(async () => {
		currentUser = get(user);
		if (currentUser) {
			bookingObject.user_id = currentUser.id;
			bookingObject.booked_by_id = currentUser.id;
		}

		await Promise.all([fetchUsers(), fetchLocations(), fetchClients(), fetchBookingContents()]);

		if (clientId) {
			bookingObject.clientId = clientId;
		}

		if (trainerId) {
			bookingObject.trainerId = trainerId;
		}

		if (startTime) {
			const currentFilters = get(calendarStore).filters;

			if (currentFilters.trainerIds?.length === 1) {
				bookingObject.trainerId = currentFilters.trainerIds[0];
			}

			if (currentFilters.locationIds?.length === 1) {
				bookingObject.locationId = currentFilters.locationIds[0];
			}

			if (currentFilters.clientIds?.length === 1) {
				bookingObject.clientId = currentFilters.clientIds[0];
			}
		}
	});

	function getLocationLabelFromId(id: number | null | undefined) {
		const list = $locations || [];
		const loc = id ? list.find((l) => l.id === id) : null;
		const address = (loc as { address?: string | null } | undefined)?.address;
		// Prefer street address (e.g., "Garvargatan 7"), then name, else fallback.
		return (address && address.trim()) || loc?.name || 'Okänd plats';
	}

	function toValidUserId(value: unknown): number | null {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}

	function getMeetingAttendeeIds() {
		return Array.from(
			new Set(
				(bookingObject.attendees ?? [])
					.map((attendeeId) => toValidUserId(attendeeId))
					.filter((attendeeId): attendeeId is number => attendeeId !== null)
			)
		);
	}

	function getMeetingBookedById() {
		return toValidUserId(bookingObject.booked_by_id) ?? toValidUserId(currentUser?.id);
	}

	async function resolveMeetingEmailRecipients() {
		const attendeeIds = getMeetingAttendeeIds();
		const bookedById = getMeetingBookedById();
		const expectedRecipientIds = new Set([
			...attendeeIds,
			...(bookedById !== null ? [bookedById] : [])
		]);

		let recipients = resolveMeetingConfirmationRecipients({
			attendeeIds,
			bookedById,
			bookedByEmail: currentUser?.email ?? null
		});

		if (recipients.length < expectedRecipientIds.size) {
			try {
				await fetchUsers();
			} catch (error) {
				console.error('Failed to refresh users for meeting email', error);
			}

			recipients = resolveMeetingConfirmationRecipients({
				attendeeIds,
				bookedById,
				bookedByEmail: currentUser?.email ?? null
			});
		}

		return recipients;
	}

	function buildMeetingEmailBody(bookedDates: BookedDateLine[]) {
		return buildMeetingConfirmationEmailBody({
			name: bookingObject.name,
			text: bookingObject.text,
			bookedDates,
			fromUser: currentUser ?? { firstname: '', lastname: '', email: '' }
		});
	}

	function openMeetingEmailPopup(recipients: string[], bookedDates: BookedDateLine[]) {
		openPopup({
			header: `Maila mötesbekräftelse till ${recipients.join(', ')}`,
			icon: 'Mail',
			component: MailComponent,
			maxWidth: '900px',
			props: {
				prefilledRecipients: recipients,
				subject: MEETING_CONFIRMATION_EMAIL_SUBJECT,
				header: MEETING_CONFIRMATION_EMAIL_HEADER,
				subheader: MEETING_CONFIRMATION_EMAIL_SUBHEADER,
				body: buildMeetingEmailBody(bookedDates),
				lockedFields: ['recipients'],
				autoFetchUsersAndClients: false
			}
		});
	}

	async function handleCreatedMeetingEmail(
		emailBehavior: 'send' | 'edit',
		bookedDates: BookedDateLine[]
	) {
		if (!currentUser) return;

		const recipients = await resolveMeetingEmailRecipients();

		if (!recipients.length) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Ingen e-postadress',
				description: 'Det saknas e-postadress för vald mottagare, så inget mail skickades.'
			});
			return;
		}

		const emailResult = await handleMeetingBookingEmail({
			emailBehavior,
			recipientEmails: recipients,
			fromUser: currentUser,
			bookedDates,
			name: bookingObject.name,
			text: bookingObject.text
		});

		if (emailResult === 'edit') {
			openMeetingEmailPopup(recipients, bookedDates);
		}
	}

	async function applyResumeSlot(slot: SelectedSlot) {
		const componentMap: Record<SelectedSlot['source'], BookingComponent> = {
			training: 'training',
			trial: 'trial',
			flight: 'flight',
			practice: 'practice',
			education: 'education'
		};

		isApplyingResumeSlot = true;
		try {
			selectedBookingComponent = componentMap[slot.source] ?? 'training';
			await tick();

			if (slot.date) bookingObject.date = slot.date;
			if (slot.time) bookingObject.time = slot.time;
			bookingObject.trainerId = slot.trainerId ?? null;
			if (bookingObject.trainerId != null) {
				bookingObject.trainerId = Number(bookingObject.trainerId);
			}
			bookingObject.locationId = slot.locationId ?? null;
			if (bookingObject.locationId != null) {
				bookingObject.locationId = Number(bookingObject.locationId);
			}
			if ('clientId' in slot) {
				const clientId = slot.clientId ?? null;
				bookingObject.clientId = clientId != null ? Number(clientId) : null;
			}
			if ('traineeId' in slot) {
				const traineeId = slot.traineeId ?? null;
				bookingObject.user_id = traineeId != null ? Number(traineeId) : null;
			}
			if (slot.bookingType) bookingObject.bookingType = slot.bookingType;
			resumeSlotApplied = true;
		} finally {
			isApplyingResumeSlot = false;
		}
	}

	async function submitBooking() {
		const type = selectedBookingComponent;
		bookingObject.currentUser = currentUser;
		if (!currentUser) return;

		const validationErrors = validateBooking(type);
		formErrors = validationErrors;
		if (Object.keys(validationErrors).length > 0) {
			return;
		}
		if (isSubmitting) {
			return;
		}
		isSubmitting = true;
		loadingStore.loading(true, 'Skapar bokning...');

		try {
			const locationName = getLocationLabelFromId(bookingObject.locationId);

			let bookedDates: BookedDateLine[] = [];
			let createdBookingIds: number[] = [];
			let success = false;

			if (
				type === 'training' ||
				type === 'trial' ||
				type === 'practice' ||
				type === 'flight' ||
				type === 'education'
			) {
				const result = await handleTrainingBooking(
					bookingObject,
					currentUser,
					repeatedBookings,
					'training'
				);
				success = result.success;
				createdBookingIds = result.bookingIds ?? [];

				if (success) {
					if (repeatedBookings.length > 0) {
						bookedDates = repeatedBookings.map((r) => ({
							date: r.date,
							time: r.selectedTime,
							locationName
						}));
					} else {
						bookedDates = [{ date: bookingObject.date, time: bookingObject.time, locationName }];
					}
				}
			} else if (type === 'meeting' || type === 'personal') {
				// meeting | personal
				const res = await handleMeetingOrPersonalBooking(
					bookingObject,
					currentUser,
					type,
					repeatedBookings
				);
				success = res.success;

				if (success) {
					bookedDates = res.bookedDates ?? [{ date: bookingObject.date, time: bookingObject.time }];
				}
			}

			const emailBehavior = (bookingObject.emailBehavior?.value ?? 'none') as
				| 'send'
				| 'edit'
				| 'none';

			if (success && emailBehavior !== 'none') {
				if (type === 'meeting') {
					await handleCreatedMeetingEmail(emailBehavior, bookedDates);
				} else if (STANDARD_EMAIL_BOOKING_TYPES.has(type)) {
					const recipientTarget =
						bookingObject.emailRecipient?.value ?? BOOKING_EMAIL_RECIPIENT_DEFAULT.value;
					const recipients = resolveBookingConfirmationRecipients({
						recipientTarget,
						clientId: bookingObject.clientId,
						trainerId: bookingObject.trainerId
					});

					if (recipients.length > 0) {
						const emailResult = await handleBookingEmail({
							emailBehavior,
							recipientEmails: recipients,
							fromUser: currentUser,
							bookedDates,
							clientId: bookingObject.clientId,
							clientRecipientEmails:
								typeof bookingObject.clientId === 'number' &&
								Number.isFinite(bookingObject.clientId)
									? getClientEmails(bookingObject.clientId)
									: []
						});

						if (emailResult === 'edit') {
							try {
								const calendarLinks: ClientCalendarEmailLinks | null =
									recipientTarget === 'client'
										? await requireClientCalendarEmailLinks(bookingObject.clientId)
										: null;
								openPopup({
									header: `Maila bokningsbekräftelse till ${recipients.join(', ')}`,
									icon: 'Mail',
									component: MailComponent,
									maxWidth: '900px',
									props: {
										prefilledRecipients: recipients,
										subject: 'Bokningsbekräftelse',
										header: 'Bekräftelse på dina bokningar',
										subheader: 'Tack för din bokning!',
										body: buildBookingConfirmationEmailBody({
											bookedDates,
											fromUser: currentUser,
											calendarSyncUrl: calendarLinks?.syncPageUrl ?? null,
											bookingsPageUrl: calendarLinks?.bookingsPageUrl ?? null
										}),
										lockedFields: ['recipients'],
										autoFetchUsersAndClients: false
									}
								});
							} catch (error) {
								console.error('Failed to create calendar links for booking email editor', error);
								addToast({
									type: AppToastType.CANCEL,
									message: 'Kunde inte skapa kalenderlänkar',
									description:
										error instanceof Error
											? error.message
											: 'Kunde inte skapa länkarna till kundens bokningar och kalender.'
								});
							}
						}
					} else {
						addToast({
							type: AppToastType.CANCEL,
							message: 'Ingen e-postadress',
							description: 'Det saknas e-postadress för vald mottagare, så inget mail skickades.'
						});
					}
				}
			}

			console.log('success', success);
			if (success) {
				console.log('hello');
				formErrors = {};
				clearSelectedSlot();
				dispatch('created', { bookingIds: createdBookingIds });
				onClose();
			}
		} finally {
			loadingStore.loading(false);
			isSubmitting = false;
		}
	}
</script>

<!-- Booking Manager UI -->
<div class="flex w-full max-w-full flex-col gap-4 bg-white sm:max-w-[600px]">
	<!-- Booking Type Selector -->

	<!-- Booking Type Selector -->

	<OptionsSelect
		bind:selectedValue={selectedBookingComponent}
		options={visibleBookingTypeOptions}
	/>

	<!-- Dynamic Booking Component -->
	{#if selectedBookingComponent === 'training' || selectedBookingComponent === 'trial' || selectedBookingComponent === 'flight'}
		<BookingTraining
			bind:bookingObject
			bind:repeatedBookings
			bookingContents={($bookingContents || []).map((content) => ({
				value: content.id,
				label: capitalizeFirstLetter(content.kind),
				icon: content.icon
			}))}
			isTrial={bookingObject.isTrial}
			isFlight={bookingObject.internal}
			errors={formErrors}
		/>
		<!-- render -->
	{:else if selectedBookingComponent === 'practice'}
		<BookingPractice
			bind:bookingObject
			users={userOptions}
			locations={($locations || []).map((l) => ({ label: l.name, value: l.id }))}
			kind="practice"
			bind:repeatedBookings
			errors={formErrors}
		/>
	{:else if selectedBookingComponent === 'education'}
		<BookingPractice
			bind:bookingObject
			users={userOptions}
			trainerOptions={educationTrainerOptions}
			locations={($locations || []).map((l) => ({ label: l.name, value: l.id }))}
			kind="education"
			bind:repeatedBookings
			errors={formErrors}
		/>
	{:else if selectedBookingComponent === 'meeting'}
		<BookingMeeting
			bind:bookingObject
			bind:repeatedBookings
			users={meetingUserOptions}
			errors={formErrors}
		/>
	{:else if selectedBookingComponent === 'personal'}
		<BookingMeeting
			bind:bookingObject
			bind:repeatedBookings
			users={meetingUserOptions}
			isMeeting={false}
			errors={formErrors}
		/>
	{/if}

	<!-- Shared Booking Button -->
	{#if selectedIsUnavailable}
		<Button
			full
			variant="primary"
			text="Slutför Bokning"
			iconLeft="CalendarCheck"
			iconLeftSize="18px"
			disabled={repeatedBookings.length > 0 && repeatedBookings.some((b) => b.conflict)}
			confirmOptions={{
				title: 'Är du säker?',
				description:
					'Den valda tiden ligger utanför den valda tränarens schema. Är du säker på att du vill slutföra bokningen ändå?',
				action: submitBooking
			}}
		/>
	{:else}
		<Button
			full
			variant="primary"
			text="Slutför Bokning"
			iconLeft="CalendarCheck"
			iconLeftSize="18px"
			on:click={submitBooking}
			disabled={repeatedBookings.length > 0 && repeatedBookings.some((b) => b.conflict)}
		/>{/if}
</div>
