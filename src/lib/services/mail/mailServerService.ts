import sgMail from '@sendgrid/mail';
import { SENDGRID_API_KEY } from '$env/static/private';
import { buildTakkeiEmail } from './mailTemplates';

sgMail.setApiKey(SENDGRID_API_KEY);

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

	// Use reply_to if from is different from the default
	const replyTo = from && from.email !== defaultFrom.email ? from : undefined;

	const msgBase = {
		from: defaultFrom,
		subject,
		text,
		html,
		...(replyTo && { reply_to: replyTo })
	};

	let msg;

	if (Array.isArray(to)) {
		msg = {
			...msgBase,
			personalizations: to.map((email) => ({
				to: [{ email }]
			}))
		};
	} else {
		msg = {
			...msgBase,
			to
		};
	}

	await sgMail
		.send(msg)
		.then(() => console.log('Email sent:', msg))
		.catch((error) => {
			console.error('SendGrid error:', error?.response?.body || error.message);
			throw error;
		});
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
