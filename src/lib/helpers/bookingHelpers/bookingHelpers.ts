import {
	createBooking,
	updateStandardBooking,
	updatePersonalBooking
} from '$lib/services/api/bookingService';
import { sendMail } from '$lib/services/mail/mailClientService';
import { getClientEmails } from '$lib/stores/clientsStore';
import { addToast } from '$lib/stores/toastStore';
import { AppToastType } from '$lib/types/toastTypes';

type BookedDateLine = { date: string; time: string; locationName?: string };

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

export async function handleTrainingBooking(
	bookingObject,
	currentUser,
	repeatedBookings,
	type: 'training'
): Promise<{ success: boolean; bookedDates?: string[] }> {
	let bookedDates: string[] = [];

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
			} else {
				addToast({
					type: AppToastType.CANCEL,
					message: `Fel vid bokning`,
					description: `Misslyckades: ${singleBooking.date} kl ${singleBooking.time}.`
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
		return { success: false };
	} else {
		const result = await createBooking(bookingObject, type);

		if (result.success) {
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Bokning genomförd',
				description: `Bokningen skapades klockan ${bookingObject.time} den ${bookingObject.date}.`
			});

			return { success: true, bookedDates: [`${bookingObject.date} kl ${bookingObject.time}`] };
		} else {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Något gick fel',
				description: `Något gick fel, försök igen eller kontakta IT.`
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
		if (
			computed &&
			start !== null &&
			computedMinutes !== null &&
			computedMinutes > start
		) {
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
				bookedDates.push({ date: repeated.date, time: chosenTime });
			} else {
				addToast({
					type: AppToastType.CANCEL,
					message: `Fel vid bokning`,
					description: `Misslyckades: ${singleBooking.date} kl ${singleBooking.time}.`
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
		const bookedDates: BookedDateLine[] = [{ date: bookingObject.date, time: bookingObject.time }];
		return { success: true, bookedDates };
	} else {
		addToast({
			type: AppToastType.CANCEL,
			message: 'Något gick fel',
			description: 'Något gick fel, försök igen eller kontakta IT.'
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

	addToast({
		type: AppToastType.CANCEL,
		message: 'Uppdatering misslyckades',
		description: response.message ?? 'Bokningen kunde inte uppdateras. Försök igen.'
	});
	return { success: false, message: response.message };
}

export async function handleBookingEmail({
	emailBehavior,
	clientEmail,
	fromUser,
	bookedDates
}: {
	emailBehavior: 'send' | 'edit' | 'none';
	clientEmail: string | string[];
	fromUser: { firstname: string; lastname: string; email: string };
	bookedDates: BookedDateLine[];
}): Promise<'sent' | 'edit' | 'skipped'> {
	const recipients = (Array.isArray(clientEmail) ? clientEmail : [clientEmail]).filter(
		(email): email is string => Boolean(email)
	);
	if (recipients.length === 0 || emailBehavior === 'none') return 'skipped';
	const recipientLabel = recipients.join(', ');

	if (emailBehavior === 'send') {
		const lines = bookedDates
			.map((b) =>
				b.locationName ? `${b.date} kl. ${b.time} på ${b.locationName}` : `${b.date} kl. ${b.time}`
			)
			.join('<br>');

		const result = await sendMail({
			to: recipients,
			subject: 'Bokningsbekräftelse',
			header: 'Bekräftelse på dina bokningar',
			subheader: 'Tack för din bokning!',
			body: `
        Hej!<br><br>
        Jag har bokat in dig följande tider:<br>
        ${lines}<br><br>
        Du kan boka av eller om din träningstid senast klockan 12.00 dagen innan träning genom att kontakta någon i ditt tränarteam via sms, e‑post eller telefon.<br><br>
        Hälsningar,<br>
        ${fromUser.firstname}<br>
        Takkei Trainingsystems
      `,
			from: {
				name: `${fromUser.firstname} ${fromUser.lastname}`,
				email: fromUser.email
			}
		});

		if (result.ok) {
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Bekräftelsemail skickat',
				description: `Ett bekräftelsemail skickades till ${recipientLabel}.`
			});
			return 'sent';
		} else {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid utskick',
				description: `Kunde inte skicka bekräftelsemail till ${recipientLabel}.`
			});
			return 'skipped';
		}
	}

	if (emailBehavior === 'edit') return 'edit';
	return 'skipped';
}
