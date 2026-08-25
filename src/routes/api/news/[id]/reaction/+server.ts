import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setNewsLikeReaction } from '$lib/server/newsService';
import { ensureTrainer, parseNewsId, requireVisibleNews } from '../../helpers';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const session = ensureTrainer(locals);
	if (!session) throw error(401, 'Unauthorized');

	const newsId = parseNewsId(params.id);
	await requireVisibleNews(session.trainerId, newsId);

	let payload: Record<string, unknown> = {};
	try {
		payload = await request.json();
	} catch {
		payload = {};
	}

	const news = await setNewsLikeReaction({
		newsId,
		trainerId: session.trainerId,
		active: Boolean(payload.active)
	});

	return json(news);
};
