import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	deleteNewsComment,
	getNewsComment,
	sanitizeNewsCommentBody,
	updateNewsComment
} from '$lib/server/newsService';
import { ensureTrainer, parseNewsId, requireVisibleNews } from '../../../helpers';

function parseCommentId(value: string | undefined) {
	const id = Number(value);
	if (!Number.isFinite(id)) throw error(400, 'Ogiltigt kommentars-id');
	return id;
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const session = ensureTrainer(locals);
	if (!session) throw error(401, 'Unauthorized');

	const newsId = parseNewsId(params.id);
	const commentId = parseCommentId(params.commentId);
	await requireVisibleNews(session.trainerId, newsId);

	const existing = await getNewsComment(newsId, commentId, session.trainerId);
	if (!existing) throw error(404, 'Kommentaren hittades inte');
	if (!existing.can_edit) throw error(403, 'Endast författaren kan redigera kommentaren');

	let payload: Record<string, unknown> = {};
	try {
		payload = await request.json();
	} catch {
		throw error(400, 'Ogiltig begäran');
	}

	const { body, error: validationError } = sanitizeNewsCommentBody(payload.body);
	if (validationError) throw error(400, validationError);

	const updated = await updateNewsComment({
		newsId,
		commentId,
		body,
		viewerId: session.trainerId
	});

	if (!updated) throw error(404, 'Kommentaren hittades inte');
	return json(updated);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const session = ensureTrainer(locals);
	if (!session) throw error(401, 'Unauthorized');

	const newsId = parseNewsId(params.id);
	const commentId = parseCommentId(params.commentId);
	await requireVisibleNews(session.trainerId, newsId);

	const existing = await getNewsComment(newsId, commentId, session.trainerId);
	if (!existing) throw error(404, 'Kommentaren hittades inte');
	if (!existing.can_delete) throw error(403, 'Saknar behörighet att ta bort kommentaren');

	await deleteNewsComment(newsId, commentId);
	return json({ success: true });
};
