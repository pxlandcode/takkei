import { createBooking } from '$lib/services/api/bookingService';
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
	bookingObject,
	currentUser,
	type: 'meeting' | 'personal'
): Promise<{ success: boolean; bookedDates?: string[] }> {
	const result = await createBooking(bookingObject, type);

	if (result.success) {
		addToast({
			type: AppToastType.SUCCESS,
			message: 'Bokning genomförd',
			description: `Bokningen skapades klockan ${bookingObject.time} den ${bookingObject.date}.`
		});

		const bookedDates = [`${bookingObject.date} kl ${bookingObject.time}`];
		return { success: true, bookedDates };
	} else {
		addToast({
			type: AppToastType.CANCEL,
			message: 'Något gick fel',
			description: `Något gick fel, försök igen eller kontakta IT.`
		});
		return { success: false };
	}
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
	bookedDates: string[];
}): Promise<'sent' | 'edit' | 'skipped'> {
	if (!clientEmail || emailBehavior === 'none') return 'skipped';

	if (emailBehavior === 'send') {
		const result = await sendMail({
			to: clientEmail,
			subject: 'Bokningsbekräftelse',
			header: 'Bekräftelse på dina bokningar',
			subheader: 'Tack för din bokning!',
			body: bookedDates.map((d) => `• ${d}`).join('<br>'),
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

	if (emailBehavior === 'edit') {
		return 'edit';
	}

	return 'skipped';
}
