import { error } from '@sveltejs/kit';
import {
	getNewsVisibleToUser,
	listNewsComments,
	listNewsVisibleToUser,
	markNewsRead
} from '$lib/server/newsService';
import type { PageServerLoad } from './$types';

type TrainerLocalsUser = NonNullable<App.Locals['user']> & {
	kind: 'trainer';
	trainer_id?: number | null;
};

function getTrainerId(locals: App.Locals) {
	const authUser = locals.user as TrainerLocalsUser | null;
	if (!authUser || authUser.kind !== 'trainer') return null;
	return authUser.trainerId ?? authUser.trainer_id ?? null;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const trainerId = getTrainerId(locals);
	if (!trainerId) throw error(401, 'Unauthorized');

	const newsId = Number(params.id);
	if (!Number.isFinite(newsId)) throw error(400, 'Ogiltigt id');

	const news = await getNewsVisibleToUser(trainerId, newsId);
	if (!news) throw error(404, 'Nyheten hittades inte');
	const didMarkRead = !news.read_at;

	const [readAt, latest, comments] = await Promise.all([
		news.read_at ? Promise.resolve(news.read_at) : markNewsRead(newsId, trainerId),
		listNewsVisibleToUser(trainerId, { limit: 10 }),
		listNewsComments(newsId, trainerId)
	]);

	return {
		news: { ...news, read_at: news.read_at ?? readAt ?? new Date().toISOString() },
		latest,
		comments,
		didMarkRead
	};
};
