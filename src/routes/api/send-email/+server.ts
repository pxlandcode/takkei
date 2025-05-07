import { sendStyledEmail } from '$lib/services/mail/mailServerService';

export const POST = async ({ request }) => {
	const { to, subject, header, subheader, body, from } = await request.json();

	if (
		(!Array.isArray(to) && typeof to !== 'string') ||
		!subject ||
		!header ||
		!subheader ||
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
