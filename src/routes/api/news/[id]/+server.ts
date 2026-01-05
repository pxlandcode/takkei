import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	canManageNews,
	deleteNews,
	getNewsVisibleToUser,
	getTrainerRoles,
	sanitizeNewsRoles,
	updateNews
} from '$lib/server/newsService';

function ensureTrainer(locals: any) {
	const authUser = locals.user;
	if (!authUser || authUser.kind !== 'trainer') return null;
	const trainerId = authUser.trainerId ?? authUser.trainer_id;
	if (!trainerId) return null;
	return { trainerId, authUser };
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const session = ensureTrainer(locals);
	if (!session) throw error(401, 'Unauthorized');

	const newsId = Number(params.id);
	if (!Number.isFinite(newsId)) throw error(400, 'Ogiltigt id');

	const news = await getNewsVisibleToUser(session.trainerId, newsId);
	if (!news) throw error(404, 'Nyheten hittades inte eller saknas behörighet');

	return json(news);
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const session = ensureTrainer(locals);
	if (!session) throw error(401, 'Unauthorized');
	const { trainerId } = session;

	const newsId = Number(params.id);
	if (!Number.isFinite(newsId)) throw error(400, 'Ogiltigt id');

	const payload = await request.json();
	const title = (payload.title ?? '').trim();
	const text = typeof payload.text === 'string' ? payload.text : '';
	const roles = sanitizeNewsRoles(payload.roles);

	if (!title) throw error(400, 'Titel krävs');
	if (!text) throw error(400, 'Text krävs');

	const userRoles = await getTrainerRoles(trainerId);
	if (!canManageNews(userRoles)) throw error(403, 'Saknar behörighet att uppdatera nyheter');

	const existing = await getNewsVisibleToUser(trainerId, newsId);
	if (!existing) throw error(404, 'Nyheten finns inte eller saknar behörighet');

	if (existing.writer_id !== trainerId) {
		throw error(403, 'Endast författaren kan uppdatera nyheten');
	}

	const updated = await updateNews({ id: newsId, title, text, roles });
	if (!updated) throw error(500, 'Kunde inte uppdatera nyheten');

	return json(updated);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const session = ensureTrainer(locals);
	if (!session) throw error(401, 'Unauthorized');
	const { trainerId } = session;

	const newsId = Number(params.id);
	if (!Number.isFinite(newsId)) throw error(400, 'Ogiltigt id');

	const userRoles = await getTrainerRoles(trainerId);
	if (!canManageNews(userRoles)) throw error(403, 'Saknar behörighet att ta bort nyheter');

	await deleteNews(newsId);
	return json({ success: true });
};
