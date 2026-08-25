import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	canDeleteNewsRecord,
	canEditNewsRecord,
	canManageNews,
	deleteNews,
	getNewsVisibleToUser,
	getTrainerRoles,
	sanitizeNewsRoles,
	updateNews
} from '$lib/server/newsService';
import { respondJsonWithEtag } from '$lib/server/http-cache';

function ensureTrainer(locals: any) {
	const authUser = locals.user;
	if (!authUser || authUser.kind !== 'trainer') return null;
	const trainerId = authUser.trainerId ?? authUser.trainer_id;
	if (!trainerId) return null;
	return { trainerId, authUser };
}

export const GET: RequestHandler = async ({ params, request, locals }) => {
	const session = ensureTrainer(locals);
	if (!session) throw error(401, 'Unauthorized');

	const newsId = Number(params.id);
	if (!Number.isFinite(newsId)) throw error(400, 'Ogiltigt id');

	const news = await getNewsVisibleToUser(session.trainerId, newsId);
	if (!news) throw error(404, 'Nyheten hittades inte eller saknas behörighet');

	return respondJsonWithEtag(request, news);
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
	const pinned = Boolean(payload.pinned);

	if (!title) throw error(400, 'Titel krävs');
	if (!text) throw error(400, 'Text krävs');

	const userRoles = await getTrainerRoles(trainerId);
	if (!canManageNews(userRoles)) throw error(403, 'Saknar behörighet att uppdatera nyheter');

	const existing = await getNewsVisibleToUser(trainerId, newsId);
	if (!existing) throw error(404, 'Nyheten finns inte eller saknar behörighet');

	if (!canEditNewsRecord(existing, trainerId, userRoles)) {
		throw error(403, 'Endast författaren kan uppdatera nyheten');
	}

	const updated = await updateNews({ id: newsId, title, text, roles, pinned, viewerId: trainerId });
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

	const existing = await getNewsVisibleToUser(trainerId, newsId);
	if (!existing) throw error(404, 'Nyheten finns inte eller saknar behörighet');

	if (!canDeleteNewsRecord(existing, trainerId, userRoles)) {
		throw error(403, 'Saknar behörighet att ta bort nyheten');
	}

	await deleteNews(newsId);
	return json({ success: true });
};
