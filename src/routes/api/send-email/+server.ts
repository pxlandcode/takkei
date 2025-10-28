import { sendStyledEmail } from '$lib/services/mail/mailServerService';

export const POST = async ({ request }) => {
	const payload = await request.json();
	const { to, subject, body, from } = payload;
	const header =
		typeof payload.header === 'string' && payload.header.trim().length
			? payload.header
			: null;
	const subheader =
		typeof payload.subheader === 'string' && payload.subheader.trim().length
			? payload.subheader
			: null;

	if (
		(!Array.isArray(to) && typeof to !== 'string') ||
		!subject ||
		!body
	) {
		return new Response('Missing or invalid fields', { status: 400 });
	}

	try {
		const emailResponse = await sendStyledEmail({ to, subject, header, subheader, body, from });

		return new Response(JSON.stringify({ ok: true, emailResponse }), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (error) {
		console.error('Email sending failed:', error);
		return new Response('Error sending email', { status: 500 });
	}
};
