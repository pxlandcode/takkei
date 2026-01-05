import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	canManageNews,
	findRecipientsByRoles,
	getTrainerRoles,
	insertNews,
	listNewsVisibleToUser,
	sanitizeNewsRoles,
	stripHtmlToText
} from '$lib/server/newsService';
import { query } from '$lib/db';
import { sendStyledEmail } from '$lib/services/mail/mailServerService';

function ensureTrainer(locals: any) {
	const authUser = locals.user;
	if (!authUser || authUser.kind !== 'trainer') return null;
	const trainerId = authUser.trainerId ?? authUser.trainer_id;
	if (!trainerId) return null;
	return { trainerId, authUser };
}

async function createNewsNotification({
	title,
	body,
	newsId,
	targetUserIds,
	creatorId
}: {
	title: string;
	body: string;
	newsId: number;
	targetUserIds: number[];
	creatorId: number;
}) {
	if (!targetUserIds?.length) return;

	const description = `${body}\nNEWS_LINK:/news/${newsId}`;

	await query(
		`
		INSERT INTO events (name, description, user_ids, start_time, end_time, event_type_id, created_by, active, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW(), 3, $4, true, NOW(), NOW())
	`,
		[`Nyhet: ${title}`, description, targetUserIds, creatorId]
	);
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const session = ensureTrainer(locals);
	if (!session) throw error(401, 'Unauthorized');

	const limit = Number(url.searchParams.get('limit') || '10');
	const offset = Number(url.searchParams.get('offset') || '0');
	const recentOnly = url.searchParams.get('latest') === '1' || url.searchParams.get('recent') === '1';

	const news = await listNewsVisibleToUser(session.trainerId, { limit, offset, recentOnly });

	return json(news);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = ensureTrainer(locals);
	if (!session) throw error(401, 'Unauthorized');
	const { trainerId, authUser } = session;

	const body = await request.json();
	const title = (body.title ?? '').trim();
	const text = typeof body.text === 'string' ? body.text : '';
	const sendEmail = Boolean(body.send_email ?? body.sendEmail);
	const roles = sanitizeNewsRoles(body.roles);

	if (!title) throw error(400, 'Titel krävs');
	if (!text) throw error(400, 'Text krävs');

	const userRoles = await getTrainerRoles(trainerId);
	if (!canManageNews(userRoles)) throw error(403, 'Saknar behörighet att skapa nyheter');

	const news = await insertNews({
		title,
		text,
		writerId: trainerId,
		roles
	});

	let emailResult: { sent: boolean; recipients: number } | null = null;

	let recipients = await findRecipientsByRoles(roles);

	// Fallback: if no recipients matched, send to all active trainers with any role
	if (!recipients.length) {
		recipients = await query(
			`SELECT DISTINCT users.id, users.email, (users.firstname || ' ' || users.lastname) AS name
			 FROM users
			 WHERE users.active = true`
		);
	}

	if (sendEmail && recipients.length > 0) {
		try {
			const to = recipients.map((r) => r.email).filter(Boolean) as string[];
			if (to.length > 0) {
				await sendStyledEmail({
					to,
					subject: `Nyhet: ${news.title}`,
					header: news.title,
					subheader: news.published_at
						? new Date(news.published_at).toLocaleString('sv-SE')
						: undefined,
					body: text,
					from: { name: `${authUser.firstname} ${authUser.lastname}`.trim() || 'Takkei', email: authUser.email }
				});
				emailResult = { sent: true, recipients: to.length };
			}
		} catch (err) {
			console.error('Failed to send news email', err);
			emailResult = { sent: false, recipients: 0 };
		}
	}

	try {
		const targetUserIds = recipients.map((r) => r.id).filter(Boolean);
		const plain = stripHtmlToText(text);
		const snippet = plain.length > 180 ? `${plain.slice(0, 177).trimEnd()}…` : plain;
		if (targetUserIds.length) {
			await createNewsNotification({
				title,
				body: snippet,
				newsId: news.id,
				targetUserIds,
				creatorId: trainerId
			});
		}
	} catch (err) {
		console.error('Failed to create news notification', err);
	}

	return json({ news, email: emailResult });
};
