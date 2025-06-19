import sgMail from '@sendgrid/mail';
import { SENDGRID_API_KEY } from '$env/static/private';
import { buildTakkeiEmail } from './mailTemplates';

sgMail.setApiKey(SENDGRID_API_KEY);

function chunkArray<T>(array: T[], size: number): T[][] {
	const chunks = [];
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}
	return chunks;
}

function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendFailureAlert({
	invalidEmails,
	failedRecipients
}: {
	invalidEmails: string[];
	failedRecipients: { batch: string[]; error: any }[];
}) {
	if (invalidEmails.length === 0 && failedRecipients.length === 0) return;

	const subject = `Problem med mailutskick (${invalidEmails.length} ogiltiga, ${failedRecipients.length} fel)`;

	let text = '';

	if (invalidEmails.length) {
		text += `Ogiltiga e-postadresser (validerades innan utskick):\n${invalidEmails.join(', ')}\n\n`;
	}

	if (failedRecipients.length) {
		text += ` Misslyckade utskick:\n`;
		for (const { batch, error } of failedRecipients) {
			text += `\nBatch:\n${batch.join(', ')}\nFel:\n${JSON.stringify(error?.response?.body || error.message, null, 2)}\n\n`;
		}
	}

	try {
		await sgMail.send({
			to: 'info@takkei.se',
			from: {
				name: 'Takkei System',
				email: 'info@takkei.se'
			},
			subject,
			text
		});
	} catch (alertError) {
		console.error(
			'❗ Misslyckades med att skicka felrapport:',
			alertError?.response?.body || alertError.message
		);
	}
}

export async function sendEmail({
	to,
	subject,
	text,
	html,
	from
}: {
	to: string | string[];
	subject: string;
	text: string;
	html?: string;
	from?: { name: string; email: string };
}) {
	const defaultFrom = {
		name: 'Takkei',
		email: 'info@takkei.se'
	};

	const replyTo = from && from.email !== defaultFrom.email ? from : undefined;

	const msgBase = {
		from: defaultFrom,
		subject,
		text,
		html,
		...(replyTo && { reply_to: replyTo })
	};

	const invalidEmails: string[] = [];
	const failedBatches: { batch: string[]; error: any }[] = [];

	if (Array.isArray(to)) {
		// Filter invalid emails
		const validRecipients = to.filter((email) => {
			const isValid = isValidEmail(email);
			if (!isValid) invalidEmails.push(email);
			return isValid;
		});

		const CHUNK_SIZE = 100;
		const batches = chunkArray(validRecipients, CHUNK_SIZE);

		for (const batch of batches) {
			const msg = {
				...msgBase,
				personalizations: batch.map((email) => ({
					to: [{ email }]
				}))
			};

			try {
				await sgMail.send(msg);
			} catch (error) {
				console.error('❌ SendGrid batch error:', error?.response?.body || error.message);
				failedBatches.push({ batch, error });
			}
		}
	} else {
		if (!isValidEmail(to)) {
			invalidEmails.push(to);
		} else {
			const msg = {
				...msgBase,
				to
			};

			try {
				await sgMail.send(msg);
			} catch (error) {
				console.error('❌ SendGrid single error:', error?.response?.body || error.message);
				failedBatches.push({ batch: [to], error });
			}
		}
	}

	await sendFailureAlert({ invalidEmails, failedRecipients: failedBatches });

	if (invalidEmails.length || failedBatches.length) {
		throw new Error('Vissa mail misslyckades, se logg/avisering.');
	}
}

export async function sendStyledEmail({
	to,
	subject,
	header,
	subheader,
	body,
	from
}: {
	to: string | string[];
	subject: string;
	header: string;
	subheader: string;
	body: string;
	from?: { name: string; email: string };
}) {
	const html = buildTakkeiEmail({ header, subheader, body });
	const text = `${header}\n\n${subheader}\n\n${body}`;

	await sendEmail({
		to,
		from,
		subject,
		text,
		html
	});
}
