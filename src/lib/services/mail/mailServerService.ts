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

async function sendFailureAlert({
	failedRecipients,
	error
}: {
	failedRecipients: string[];
	error: any;
}) {
	const subject = `❌ Mailutskick misslyckades (${failedRecipients.length} mottagare)`;

	const text = `
Följande mailutskick misslyckades:

${failedRecipients.join(', ')}

Felmeddelande:
${JSON.stringify(error?.response?.body || error.message, null, 2)}
	`;

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

	if (Array.isArray(to)) {
		const CHUNK_SIZE = 100;
		const batches = chunkArray(to, CHUNK_SIZE);

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
				await sendFailureAlert({ failedRecipients: batch, error });
				throw error;
			}
		}
	} else {
		const msg = {
			...msgBase,
			to
		};

		try {
			await sgMail.send(msg);
		} catch (error) {
			console.error('❌ SendGrid single error:', error?.response?.body || error.message);
			await sendFailureAlert({ failedRecipients: [to], error });
			throw error;
		}
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
