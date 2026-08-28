import {
	createBooking,
	updateStandardBooking,
	updatePersonalBooking
} from '$lib/services/api/bookingService';
import { sendMail } from '$lib/services/mail/mailClientService';
import { getClientEmails } from '$lib/stores/clientsStore';
import { getUserEmails } from '$lib/stores/usersStore';
import { addToast } from '$lib/stores/toastStore';
import { AppToastType } from '$lib/types/toastTypes';

export type BookedDateLine = {
	date: string;
	time: string;
	endTime?: string | null;
	locationName?: string;
};
export type BookingEmailRecipientTarget = 'both' | 'client';
export type ClientCalendarEmailLinks = {
	syncPageUrl: string;
	bookingsPageUrl: string;
};

export const MEETING_CONFIRMATION_EMAIL_SUBJECT = 'Mötesbekräftelse';
export const MEETING_CONFIRMATION_EMAIL_HEADER = 'Möte inbokat';
export const MEETING_CONFIRMATION_EMAIL_SUBHEADER = 'Detaljer för mötet';

export const BOOKING_EMAIL_RECIPIENT_OPTIONS: {
	value: BookingEmailRecipientTarget;
	label: string;
}[] = [
	{ value: 'both', label: 'Tränare & klient' },
	{ value: 'client', label: 'Klient' }
];

export const BOOKING_EMAIL_RECIPIENT_DEFAULT = BOOKING_EMAIL_RECIPIENT_OPTIONS[0];

function timeStringToMinutes(value?: string | null): number | null {
	if (!value) return null;
	const [hours, minutes] = value.split(':').map(Number);
	if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
	return hours * 60 + minutes;
}

function minutesToTimeString(totalMinutes: number): string {
	const normalized = ((totalMinutes % 1440) + 1440) % 1440;
	const hours = Math.floor(normalized / 60);
	const minutes = normalized % 60;
	return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function getUniqueRecipients(recipients: string[]): string[] {
	return Array.from(new Set(recipients.filter((email): email is string => Boolean(email))));
}

function escapeHtmlAttribute(raw: string): string {
	return raw
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function escapeHtml(raw: string): string {
	return raw
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function escapeHtmlWithLineBreaks(raw: string): string {
	return escapeHtml(raw).replace(/\r\n|\n|\r/g, '<br>');
}

function getUserDisplayName(user: {
	firstname?: string | null;
	lastname?: string | null;
	email?: string | null;
}): string {
	const name = [user.firstname, user.lastname]
		.map((part) => part?.trim())
		.filter((part): part is string => Boolean(part))
		.join(' ');
	return name || user.email?.trim() || 'Takkei';
}

function toFiniteNumber(value: unknown): number | null {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function formatMeetingBookedDateLine(booking: BookedDateLine): string {
	const date = escapeHtml(booking.date);
	const startTime = escapeHtml(booking.time);
	const endTime = booking.endTime ? escapeHtml(booking.endTime) : null;
	return endTime ? `${date} kl. ${startTime} - ${endTime}` : `${date} kl. ${startTime}`;
}

export function buildBookingConfirmationEmailBody({
	bookedDates,
	fromUser,
	calendarSyncUrl = null,
	bookingsPageUrl = null
}: {
	bookedDates: BookedDateLine[];
	fromUser: { firstname: string };
	calendarSyncUrl?: string | null;
	bookingsPageUrl?: string | null;
}): string {
	const lines = bookedDates
		.map((b) =>
			b.locationName ? `${b.date} kl. ${b.time} på ${b.locationName}` : `${b.date} kl. ${b.time}`
		)
		.join('<br>');

	const calendarLinks =
		calendarSyncUrl || bookingsPageUrl
			? `<br><br><div>
				${
					calendarSyncUrl
						? `<a href="${escapeHtmlAttribute(calendarSyncUrl)}" style="display:inline-block;background:#dd890b;color:#ffffff;text-decoration:none;border-radius:4px;padding:10px 14px;font-weight:600;margin:0 8px 8px 0;">Prenumerera i din kalender</a>`
						: ''
				}
				${
					bookingsPageUrl
						? `<a href="${escapeHtmlAttribute(bookingsPageUrl)}" style="display:inline-block;background:#ffffff;color:#3e3e3e;text-decoration:none;border:1px solid #3e3e3e;border-radius:4px;padding:10px 14px;font-weight:600;margin:0 0 8px 0;">Se alla dina bokningar</a>`
						: ''
				}
			</div>`
			: '';

	return `
        Hej!<br><br>
        Jag har bokat in dig följande tider:<br>
        ${lines}<br><br>
        Du kan boka av eller om din träningstid senast klockan 12.00 dagen innan träning genom att kontakta någon i ditt tränarteam via sms, e‑post eller telefon.${calendarLinks}<br><br>
        Hälsningar,<br>
        ${fromUser.firstname}<br>
        Takkei Trainingsystems
      `;
}

export function buildMeetingConfirmationEmailBody({
	name,
	text,
	bookedDates,
	fromUser
}: {
	name?: string | null;
	text?: string | null;
	bookedDates: BookedDateLine[];
	fromUser: { firstname?: string | null; lastname?: string | null; email?: string | null };
}): string {
	const meetingName = name?.trim() ? escapeHtml(name.trim()) : 'Möte';
	const description = text?.trim()
		? escapeHtmlWithLineBreaks(text.trim())
		: 'Ingen beskrivning angiven.';
	const bookedByName = escapeHtml(getUserDisplayName(fromUser));
	const greetingName = escapeHtml(fromUser.firstname?.trim() || getUserDisplayName(fromUser));
	const dateLines = bookedDates.map(formatMeetingBookedDateLine).join('<br>');

	return `
        Hej!<br><br>
        Du har bokats in på ett möte med följande detaljer:<br><br>
        <strong>Namn:</strong> ${meetingName}<br>
        <strong>Beskrivning:</strong><br>
        ${description}<br>
        <strong>Datum och tid:</strong><br>
        ${dateLines}<br><br>
        <strong>Bokad av:</strong> ${bookedByName}<br><br>
        Hälsningar,<br>
        ${greetingName}<br>
        Takkei Trainingsystems
      `;
}

function splitClientRecipients(
	recipients: string[],
	clientId?: number | null,
	clientRecipientEmails: string[] = []
) {
	if (typeof clientId !== 'number' || !Number.isFinite(clientId)) {
		return { clientRecipients: [], otherRecipients: recipients };
	}

	const clientEmails = new Set(
		[...getClientEmails(clientId), ...clientRecipientEmails].map((email) => email.toLowerCase())
	);
	const clientRecipients = recipients.filter((email) => clientEmails.has(email.toLowerCase()));
	const otherRecipients = recipients.filter((email) => !clientEmails.has(email.toLowerCase()));

	return {
		clientRecipients: getUniqueRecipients(clientRecipients),
		otherRecipients: getUniqueRecipients(otherRecipients)
	};
}

export async function createClientCalendarEmailLinks(
	clientId?: number | null
): Promise<ClientCalendarEmailLinks | null> {
	if (typeof clientId !== 'number' || !Number.isFinite(clientId)) return null;

	try {
		const response = await fetch(`/api/clients/${clientId}/calendar-subscription`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({})
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => '');
			console.error('Failed to create client calendar links', response.status, errorText);
			return null;
		}

		const payload = await response.json();
		if (typeof payload?.syncPageUrl !== 'string' || typeof payload?.bookingsPageUrl !== 'string') {
			console.error('Client calendar link response did not include expected URLs', payload);
			return null;
		}

		return {
			syncPageUrl: payload.syncPageUrl,
			bookingsPageUrl: payload.bookingsPageUrl
		};
	} catch (error) {
		console.error('Failed to create client calendar links', error);
		return null;
	}
}

export async function requireClientCalendarEmailLinks(
	clientId?: number | null
): Promise<ClientCalendarEmailLinks> {
	const links = await createClientCalendarEmailLinks(clientId);
	if (!links) {
		throw new Error('Kunde inte skapa länkarna till kundens bokningar och kalender.');
	}
	return links;
}

export async function createClientCalendarSyncLink(
	clientId?: number | null
): Promise<string | null> {
	return (await createClientCalendarEmailLinks(clientId))?.syncPageUrl ?? null;
}

export function resolveBookingConfirmationRecipients({
	recipientTarget = BOOKING_EMAIL_RECIPIENT_DEFAULT.value,
	clientId,
	trainerId
}: {
	recipientTarget?: BookingEmailRecipientTarget;
	clientId?: number | null;
	trainerId?: number | number[] | null;
}): string[] {
	const clientRecipients =
		typeof clientId === 'number' && Number.isFinite(clientId) ? getClientEmails(clientId) : [];
	const trainerRecipients =
		typeof trainerId === 'number'
			? Number.isFinite(trainerId)
				? getUserEmails(trainerId)
				: []
			: Array.isArray(trainerId)
				? getUserEmails(trainerId)
				: [];

	if (recipientTarget === 'both') {
		return getUniqueRecipients([...clientRecipients, ...trainerRecipients]);
	}

	return getUniqueRecipients(clientRecipients);
}

export function resolveMeetingConfirmationRecipients({
	attendeeIds = [],
	bookedById = null,
	bookedByEmail = null
}: {
	attendeeIds?: Array<number | string | null | undefined> | null;
	bookedById?: number | string | null;
	bookedByEmail?: string | null;
}): string[] {
	const userIds = new Set<number>();

	for (const attendeeId of attendeeIds ?? []) {
		const parsed = toFiniteNumber(attendeeId);
		if (parsed !== null) userIds.add(parsed);
	}

	const parsedBookedById = toFiniteNumber(bookedById);
	if (parsedBookedById !== null) userIds.add(parsedBookedById);

	return getUniqueRecipients([...getUserEmails(Array.from(userIds)), bookedByEmail ?? '']);
}

export async function handleTrainingBooking(
	bookingObject: any,
	currentUser: any,
	repeatedBookings: any[],
	type: 'training'
): Promise<{ success: boolean; bookedDates?: string[]; bookingIds?: number[] }> {
	let bookedDates: string[] = [];
	let bookingIds: number[] = [];

	if (repeatedBookings.length > 0) {
		let successCount = 0;

		for (const repeated of repeatedBookings) {
			const singleBooking = {
				...bookingObject,
				date: repeated.date,
				time: repeated.selectedTime
			};
			const result = await createBooking(singleBooking, type);

			if (result.success) {
				successCount++;
				bookedDates.push(`${repeated.date} kl ${repeated.selectedTime}`);
				if (Number.isInteger(Number(result.bookingId))) bookingIds.push(Number(result.bookingId));
			} else {
				const errorDetails = result.error ?? result.message;
				addToast({
					type: AppToastType.CANCEL,
					message: `Fel vid bokning`,
					description: errorDetails
						? `${errorDetails} (${singleBooking.date} kl ${singleBooking.time}).`
						: `Misslyckades: ${singleBooking.date} kl ${singleBooking.time}.`
				});
			}
		}

		if (successCount === repeatedBookings.length) {
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Alla bokningar klara!',
				description: `${successCount} av ${repeatedBookings.length} lyckades.`
			});

			return { success: true, bookedDates, bookingIds };
		}
		return { success: false };
	} else {
		const result = await createBooking(bookingObject, type);

		if (result.success) {
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Bokning genomförd',
				description: `Bokningen skapades klockan ${bookingObject.time} den ${bookingObject.date}.`
			});

			return {
				success: true,
				bookedDates: [`${bookingObject.date} kl ${bookingObject.time}`],
				bookingIds: Number.isInteger(Number(result.bookingId)) ? [Number(result.bookingId)] : []
			};
		} else {
			const errorDetails = result.error ?? result.message;
			addToast({
				type: AppToastType.CANCEL,
				message: 'Något gick fel',
				description: errorDetails ?? 'Något gick fel, försök igen eller kontakta IT.'
			});
			return { success: false };
		}
	}
}

export async function handleMeetingOrPersonalBooking(
	bookingObject: any,
	currentUser: any,
	type: 'meeting' | 'personal',
	repeatedBookings: any[] = []
): Promise<{ success: boolean; bookedDates?: BookedDateLine[] }> {
	const startMinutes = timeStringToMinutes(bookingObject.time);
	const endMinutes = timeStringToMinutes(bookingObject.endTime);
	const durationMinutes =
		startMinutes !== null && endMinutes !== null && endMinutes > startMinutes
			? endMinutes - startMinutes
			: null;

	const fallbackEndTime = bookingObject.endTime ?? bookingObject.time;

	const computeEndTime = (startTime: string | undefined): string => {
		if (!startTime) return fallbackEndTime;
		if (durationMinutes === null) return fallbackEndTime;
		const start = timeStringToMinutes(startTime);
		if (start === null) return fallbackEndTime;
		return minutesToTimeString(start + durationMinutes);
	};

	const resolveEndTime = (startTime: string, candidate?: string | null): string => {
		const start = timeStringToMinutes(startTime);
		if (candidate) {
			const candidateMinutes = timeStringToMinutes(candidate);
			if (start !== null && candidateMinutes !== null && candidateMinutes > start) {
				return candidate;
			}
		}

		const computed = computeEndTime(startTime);
		const computedMinutes = timeStringToMinutes(computed);
		if (computed && start !== null && computedMinutes !== null && computedMinutes > start) {
			return computed;
		}

		if (candidate) return candidate;
		return fallbackEndTime;
	};

	if (bookingObject.repeat && repeatedBookings.length > 0) {
		let successCount = 0;
		const bookedDates: BookedDateLine[] = [];

		for (const repeated of repeatedBookings) {
			const chosenTime = repeated.selectedTime ?? repeated.time ?? bookingObject.time;
			const chosenEndTime = resolveEndTime(
				chosenTime,
				repeated.selectedEndTime ?? repeated.endTime ?? null
			);
			const singleBooking = {
				...bookingObject,
				date: repeated.date,
				time: chosenTime,
				endTime: chosenEndTime
			};

			const result = await createBooking(singleBooking, type);

			if (result.success) {
				successCount++;
				bookedDates.push({ date: repeated.date, time: chosenTime, endTime: chosenEndTime });
			} else {
				const errorDetails = result.error ?? result.message;
				addToast({
					type: AppToastType.CANCEL,
					message: `Fel vid bokning`,
					description: errorDetails
						? `${errorDetails} (${singleBooking.date} kl ${singleBooking.time}).`
						: `Misslyckades: ${singleBooking.date} kl ${singleBooking.time}.`
				});
			}
		}

		if (successCount === repeatedBookings.length) {
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Alla bokningar klara!',
				description: `${successCount} av ${repeatedBookings.length} lyckades.`
			});

			return { success: true, bookedDates };
		}

		addToast({
			type: AppToastType.CANCEL,
			message: 'Något gick fel',
			description: `Endast ${successCount} av ${repeatedBookings.length} bokningar lyckades.`
		});
		return { success: false };
	}

	const result = await createBooking(bookingObject, type);

	if (result.success) {
		addToast({
			type: AppToastType.SUCCESS,
			message: 'Bokning genomförd',
			description: `Bokningen skapades klockan ${bookingObject.time} den ${bookingObject.date}.`
		});

		// No location for meeting/personal
		const bookedDates: BookedDateLine[] = [
			{ date: bookingObject.date, time: bookingObject.time, endTime: bookingObject.endTime }
		];
		return { success: true, bookedDates };
	} else {
		const errorDetails = result.error ?? result.message;
		addToast({
			type: AppToastType.CANCEL,
			message: 'Något gick fel',
			description: errorDetails ?? 'Något gick fel, försök igen eller kontakta IT.'
		});
		return { success: false };
	}
}

export async function updateTrainingBooking(
	bookingObject: any
): Promise<{ success: boolean; booking?: any; message?: string }> {
	const result = await updateStandardBooking(bookingObject);

	if (result.success) {
		addToast({
			type: AppToastType.SUCCESS,
			message: 'Bokning uppdaterad',
			description: `Bokningen uppdaterades till ${bookingObject.date} kl ${bookingObject.time}.`
		});
		return { success: true, booking: result.booking };
	}

	addToast({
		type: AppToastType.CANCEL,
		message: 'Uppdatering misslyckades',
		description: result.message ?? 'Bokningen kunde inte uppdateras. Försök igen.'
	});
	return { success: false, message: result.message };
}

export async function updateMeetingOrPersonalBooking(
	bookingObject: any,
	type: 'meeting' | 'personal',
	kind: string
): Promise<{ success: boolean; booking?: any; message?: string }> {
	const response = await updatePersonalBooking(bookingObject, kind);

	if (response.success) {
		addToast({
			type: AppToastType.SUCCESS,
			message: 'Bokning uppdaterad',
			description: `Bokningen uppdaterades till ${bookingObject.date} kl ${bookingObject.time}.`
		});
		return { success: true, booking: response.booking };
	}

	const errorMessage = response.error ?? response.message;
	addToast({
		type: AppToastType.CANCEL,
		message: 'Uppdatering misslyckades',
		description: errorMessage ?? 'Bokningen kunde inte uppdateras. Försök igen.'
	});
	return { success: false, message: errorMessage };
}

export async function handleBookingEmail({
	emailBehavior,
	recipientEmails,
	fromUser,
	bookedDates,
	clientId = null,
	clientRecipientEmails = []
}: {
	emailBehavior: 'send' | 'edit' | 'none';
	recipientEmails: string[];
	fromUser: { firstname: string; lastname: string; email: string };
	bookedDates: BookedDateLine[];
	clientId?: number | null;
	clientRecipientEmails?: string[];
}): Promise<'sent' | 'edit' | 'skipped'> {
	const recipients = getUniqueRecipients(recipientEmails);
	if (recipients.length === 0 || emailBehavior === 'none') return 'skipped';
	const recipientLabel = recipients.join(', ');

	if (emailBehavior === 'send') {
		const { clientRecipients, otherRecipients } = splitClientRecipients(
			recipients,
			clientId,
			clientRecipientEmails
		);
		const from = {
			name: `${fromUser.firstname} ${fromUser.lastname}`,
			email: fromUser.email
		};

		try {
			const calendarLinks = clientRecipients.length
				? await requireClientCalendarEmailLinks(clientId)
				: null;

			if (clientRecipients.length) {
				await sendMail({
					to: clientRecipients,
					subject: 'Bokningsbekräftelse',
					header: 'Bekräftelse på dina bokningar',
					subheader: 'Tack för din bokning!',
					body: buildBookingConfirmationEmailBody({
						bookedDates,
						fromUser,
						calendarSyncUrl: calendarLinks?.syncPageUrl ?? null,
						bookingsPageUrl: calendarLinks?.bookingsPageUrl ?? null
					}),
					from
				});
			}

			if (otherRecipients.length) {
				await sendMail({
					to: otherRecipients,
					subject: 'Bokningsbekräftelse',
					header: 'Bekräftelse på dina bokningar',
					subheader: 'Tack för din bokning!',
					body: buildBookingConfirmationEmailBody({ bookedDates, fromUser }),
					from
				});
			}

			addToast({
				type: AppToastType.SUCCESS,
				message: 'Bekräftelsemail skickat',
				description: `Ett bekräftelsemail skickades till ${recipientLabel}.`
			});
			return 'sent';
		} catch (error) {
			console.error('Failed to send booking confirmation email', error);
			const errorMessage =
				error instanceof Error
					? error.message
					: `Kunde inte skicka bekräftelsemail till ${recipientLabel}.`;
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid utskick',
				description: errorMessage
			});
			return 'skipped';
		}
	}

	if (emailBehavior === 'edit') return 'edit';
	return 'skipped';
}

export async function handleMeetingBookingEmail({
	emailBehavior,
	recipientEmails,
	fromUser,
	bookedDates,
	name,
	text
}: {
	emailBehavior: 'send' | 'edit' | 'none';
	recipientEmails: string[];
	fromUser: { firstname: string; lastname: string; email: string };
	bookedDates: BookedDateLine[];
	name?: string | null;
	text?: string | null;
}): Promise<'sent' | 'edit' | 'skipped'> {
	const recipients = getUniqueRecipients(recipientEmails);
	if (recipients.length === 0 || emailBehavior === 'none') return 'skipped';
	const recipientLabel = recipients.join(', ');

	if (emailBehavior === 'send') {
		try {
			await sendMail({
				to: recipients,
				subject: MEETING_CONFIRMATION_EMAIL_SUBJECT,
				header: MEETING_CONFIRMATION_EMAIL_HEADER,
				subheader: MEETING_CONFIRMATION_EMAIL_SUBHEADER,
				body: buildMeetingConfirmationEmailBody({
					name,
					text,
					bookedDates,
					fromUser
				}),
				from: {
					name: `${fromUser.firstname} ${fromUser.lastname}`,
					email: fromUser.email
				}
			});

			addToast({
				type: AppToastType.SUCCESS,
				message: 'Mötesbekräftelse skickad',
				description: `Ett bekräftelsemail skickades till ${recipientLabel}.`
			});
			return 'sent';
		} catch (error) {
			console.error('Failed to send meeting confirmation email', error);
			const errorMessage =
				error instanceof Error
					? error.message
					: `Kunde inte skicka mötesbekräftelse till ${recipientLabel}.`;
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid utskick',
				description: errorMessage
			});
			return 'skipped';
		}
	}

	if (emailBehavior === 'edit') return 'edit';
	return 'skipped';
}
