import sgMail from '@sendgrid/mail';
import { SENDGRID_API_KEY } from '$env/static/private';
import { buildTakkeiEmail } from './mailTemplates';

sgMail.setApiKey(SENDGRID_API_KEY);

export async function sendEmail({
	to,
	subject,
	text,
	html
}: {
	to: string | string[];
	subject: string;
	text: string;
	html?: string;
}) {
	const from = {
		name: 'Takkei',
		email: 'info@takkei.se'
	};

	let msg;

	if (Array.isArray(to)) {
		msg = {
			from,
			subject,
			text,
			html,
			personalizations: to.map((email) => ({
				to: [{ email }]
			}))
		};
	} else {
		msg = {
			from,
			to,
			subject,
			text,
			html
		};
	}

	await sgMail.send(msg);
}

/**
 * Sends a styled Takkei email with layout, logo, banner and branding.
 */
export async function sendStyledEmail({
	to,
	subject,
	header,
	subheader,
	body
}: {
	to: string | string[];
	subject: string;
	header: string;
	subheader: string;
	body: string;
}) {
	const html = buildTakkeiEmail({ header, subheader, body });
	const text = `${header}\n\n${subheader}\n\n${body}`;

	await sendEmail({
		to,
		subject,
		text,
		html
	});
}
