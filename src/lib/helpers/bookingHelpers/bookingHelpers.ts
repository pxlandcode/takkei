import {
	createBooking,
	updateStandardBooking,
	updatePersonalBooking
} from '$lib/services/api/bookingService';
import { sendMail } from '$lib/services/mail/mailClientService';
import { getClientEmails } from '$lib/stores/clientsStore';
import { addToast } from '$lib/stores/toastStore';
import { AppToastType } from '$lib/types/toastTypes';

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
	type: 'meeting' | 'personal'
): Promise<{ success: boolean; bookedDates?: BookedDateLine[] }> {
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
): Promise<{ success: boolean }> {
	const result = await updateStandardBooking(bookingObject);

	if (result.success) {
		addToast({
			type: AppToastType.SUCCESS,
			message: 'Bokning uppdaterad',
			description: `Bokningen uppdaterades till ${bookingObject.date} kl ${bookingObject.time}.`
		});
		return { success: true };
	}

	addToast({
		type: AppToastType.CANCEL,
		message: 'Uppdatering misslyckades',
		description: result.message ?? 'Bokningen kunde inte uppdateras. Försök igen.'
	});
	return { success: false };
}

export async function updateMeetingOrPersonalBooking(
	bookingObject: any,
	type: 'meeting' | 'personal',
	kind: string
): Promise<{ success: boolean }> {
	const response = await updatePersonalBooking(bookingObject, kind);

	if (response.success) {
		addToast({
			type: AppToastType.SUCCESS,
			message: 'Bokning uppdaterad',
			description: `Bokningen uppdaterades till ${bookingObject.date} kl ${bookingObject.time}.`
		});
		return { success: true };
	}

	addToast({
		type: AppToastType.CANCEL,
		message: 'Uppdatering misslyckades',
		description: response.message ?? 'Bokningen kunde inte uppdateras. Försök igen.'
	});
	return { success: false };
}

export async function handleBookingEmail({
	emailBehavior,
	clientEmail,
	fromUser,
	bookedDates
}: {
	emailBehavior: 'send' | 'edit' | 'none';
	clientEmail: string;
	fromUser: { firstname: string; lastname: string; email: string };
	bookedDates: BookedDateLine[];
}): Promise<'sent' | 'edit' | 'skipped'> {
	if (!clientEmail || emailBehavior === 'none') return 'skipped';

	if (emailBehavior === 'send') {
		const lines = bookedDates
			.map((b) =>
				b.locationName ? `${b.date} kl. ${b.time} på ${b.locationName}` : `${b.date} kl. ${b.time}`
			)
			.join('<br>');

		const result = await sendMail({
			to: clientEmail,
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
				description: `Ett bekräftelsemail skickades till ${clientEmail}.`
			});
			return 'sent';
		} else {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid utskick',
				description: `Kunde inte skicka bekräftelsemail till ${clientEmail}.`
			});
			return 'skipped';
		}
	}

	if (emailBehavior === 'edit') return 'edit';
	return 'skipped';
}
