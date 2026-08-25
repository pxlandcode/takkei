import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	insertNewsComment,
	listNewsComments,
	sanitizeNewsCommentBody
} from '$lib/server/newsService';
import { ensureTrainer, parseNewsId, requireVisibleNews } from '../../helpers';

export const GET: RequestHandler = async ({ params, locals }) => {
	const session = ensureTrainer(locals);
	if (!session) throw error(401, 'Unauthorized');

	const newsId = parseNewsId(params.id);
	await requireVisibleNews(session.trainerId, newsId);

	const comments = await listNewsComments(newsId, session.trainerId);
	return json(comments);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const session = ensureTrainer(locals);
	if (!session) throw error(401, 'Unauthorized');

	const newsId = parseNewsId(params.id);
	await requireVisibleNews(session.trainerId, newsId);

	let payload: Record<string, unknown> = {};
	try {
		payload = await request.json();
	} catch {
		throw error(400, 'Ogiltig begäran');
	}

	const { body, error: validationError } = sanitizeNewsCommentBody(payload.body);
	if (validationError) throw error(400, validationError);

	const comment = await insertNewsComment({
		newsId,
		trainerId: session.trainerId,
		body
	});

	return json(comment, { status: 201 });
};
