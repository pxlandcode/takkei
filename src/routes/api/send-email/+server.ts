import { sendStyledEmail } from '$lib/services/mail/mailServerService';
import { query } from '$lib/db';

export const POST = async ({ request, locals }) => {
        const authUser = locals.user;
        if (!authUser) {
                return new Response('Unauthorized', { status: 401 });
        }

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
                const actualFrom = from ?? { name: 'Takkei', email: 'info@takkei.se' };
                const sendResult = await sendStyledEmail({ to, subject, header, subheader, body, from: actualFrom });

                let historyId: number | null = null;

                try {
			const senderUserId =
				authUser.kind === 'trainer'
					? authUser.trainerId ?? authUser.trainer_id ?? null
					: null;
                        const senderNameParts = [authUser.firstname, authUser.lastname].filter(Boolean);
                        const senderName = senderNameParts.length ? senderNameParts.join(' ') : null;
                        const senderEmail = authUser.email ?? null;

                        const recipientsPayload = sendResult.validRecipients.map((email: string) => ({ email }));

                        const insertResult = await query(
                                `INSERT INTO mail_history (
                                        sender_user_id,
                                        sender_name,
                                        sender_email,
                                        recipients,
                                        recipients_count,
                                        subject,
                                        header,
                                        subheader,
                                        body_html,
                                        body_text,
                                        sent_from,
                                        status
                                ) VALUES (
                                        $1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11::jsonb, $12
                                )
                                RETURNING id`,
                                [
                                        senderUserId,
                                        senderName,
                                        senderEmail,
                                        JSON.stringify(recipientsPayload),
                                        sendResult.validRecipients.length,
                                        subject,
                                        sendResult.header,
                                        sendResult.subheader,
                                        sendResult.html,
                                        sendResult.text,
                                        JSON.stringify(actualFrom),
                                        'sent'
                                ]
                        );

                        historyId = insertResult?.[0]?.id ?? null;
                } catch (logError) {
                        console.warn('Failed to persist mail history entry', logError);
                }

                return new Response(
                        JSON.stringify({ ok: true, emailResponse: { validRecipients: sendResult.validRecipients }, mailHistoryId: historyId }),
                        {
                                headers: { 'content-type': 'application/json' }
                        }
                );
        } catch (error) {
                console.error('Email sending failed:', error);
                return new Response('Error sending email', { status: 500 });
        }
};
