import { error } from '@sveltejs/kit';
import { getNewsVisibleToUser } from '$lib/server/newsService';

type TrainerSessionUser = NonNullable<App.Locals['user']> & {
	kind: 'trainer';
	trainerId?: number | null;
	trainer_id?: number | null;
};

export function ensureTrainer(locals: App.Locals) {
	const authUser = locals.user as TrainerSessionUser | null;
	if (!authUser || authUser.kind !== 'trainer') return null;
	const trainerId = authUser.trainerId ?? authUser.trainer_id;
	if (!trainerId) return null;
	return { trainerId, authUser };
}

export function parseNewsId(value: string | undefined) {
	const id = Number(value);
	if (!Number.isFinite(id)) throw error(400, 'Ogiltigt id');
	return id;
}

export async function requireVisibleNews(trainerId: number, newsId: number) {
	const news = await getNewsVisibleToUser(trainerId, newsId);
	if (!news) throw error(404, 'Nyheten hittades inte eller saknas behörighet');
	return news;
}
