import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { markNewsRead } from '$lib/server/newsService';
import { ensureTrainer, parseNewsId, requireVisibleNews } from '../../helpers';

export const PUT: RequestHandler = async ({ params, locals }) => {
	const session = ensureTrainer(locals);
	if (!session) throw error(401, 'Unauthorized');

	const newsId = parseNewsId(params.id);
	await requireVisibleNews(session.trainerId, newsId);

	const news = await markNewsRead(newsId, session.trainerId);
	return json(news);
};
