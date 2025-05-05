export async function sendMail({
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
	const res = await fetch('/api/send-email', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ to, subject, header, subheader, body })
	});

	if (!res.ok) {
		const error = await res.text();
		throw new Error(error || 'Failed to send email');
	}

	return await res.json();
}
