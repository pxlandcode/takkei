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
): Promise<boolean> {
	let bookedDates = [];

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

			if (bookingObject.clientId) {
				const clientEmail = getClientEmails(bookingObject.clientId);
				if (clientEmail) {
					const result = await sendMail({
						to: clientEmail,
						subject: 'Bokningsbekräftelse',
						header: 'Bekräftelse på dina bokningar',
						subheader: 'Tack för din bokning!',
						body: bookedDates.map((d) => `• ${d}`).join('<br>'),
						from: {
							name: `${currentUser.firstname} ${currentUser.lastname}`,
							email: currentUser.email
						}
					});
					if (result.ok) {
						addToast({
							type: AppToastType.SUCCESS,
							message: 'Bekräftelsemail skickat',
							description: `Ett bekräftelsemail skickades till ${clientEmail}.`
						});
					} else {
						addToast({
							type: AppToastType.CANCEL,
							message: 'Fel vid utskick',
							description: `Kunde inte skicka bekräftelsemail till ${clientEmail}.`
						});
					}
				}
			}

			return true;
		} else {
			return false;
		}
	} else {
		const result = await createBooking(bookingObject, type);

		if (result.success) {
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Bokning genomförd',
				description: `Bokningen skapades klockan ${bookingObject.time} den ${bookingObject.date}.`
			});

			if (bookingObject.clientId) {
				const clientEmail = getClientEmails(bookingObject.clientId);
				if (clientEmail) {
					await sendMail({
						to: clientEmail,
						subject: 'Bokningsbekräftelse',
						header: 'Bekräftelse på din bokning',
						subheader: 'Tack för din bokning!',
						body: `${bookingObject.date} kl ${bookingObject.time}`,
						from: {
							name: `${currentUser.firstname} ${currentUser.lastname}`,
							email: currentUser.email
						}
					});

					addToast({
						type: AppToastType.SUCCESS,
						message: 'Bekräftelsemail skickat',
						description: `Ett bekräftelsemail skickades till ${clientEmail}.`
					});
				}
			}

			return true;
		} else {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Något gick fel',
				description: `Något gick fel, försök igen eller kontakta IT.`
			});
			return false;
		}
	}
}

export async function handleMeetingOrPersonalBooking(
	bookingObject,
	currentUser,
	type: 'meeting' | 'personal'
): Promise<boolean> {
	const result = await createBooking(bookingObject, type);

	if (result.success) {
		addToast({
			type: AppToastType.SUCCESS,
			message: 'Bokning genomförd',
			description: `Bokningen skapades klockan ${bookingObject.time} den ${bookingObject.date}.`
		});
		return true;
	} else {
		addToast({
			type: AppToastType.CANCEL,
			message: 'Något gick fel',
			description: `Något gick fel, försök igen eller kontakta IT.`
		});
		return false;
	}
}
