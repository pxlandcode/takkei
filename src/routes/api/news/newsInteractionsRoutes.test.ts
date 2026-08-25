import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/newsService', () => ({
	deleteNewsComment: vi.fn(),
	getNewsComment: vi.fn(),
	getNewsVisibleToUser: vi.fn(),
	insertNewsComment: vi.fn(),
	listNewsComments: vi.fn(),
	markNewsRead: vi.fn(),
	sanitizeNewsCommentBody: vi.fn((value) => {
		const body = typeof value === 'string' ? value.trim() : '';
		return body ? { body, error: null } : { body, error: 'Kommentar krävs' };
	}),
	setNewsLikeReaction: vi.fn(),
	updateNewsComment: vi.fn()
}));

import {
	deleteNewsComment,
	getNewsComment,
	getNewsVisibleToUser,
	insertNewsComment,
	listNewsComments,
	markNewsRead,
	setNewsLikeReaction,
	updateNewsComment
} from '$lib/server/newsService';
import { PUT as PUT_READ } from './[id]/read/+server';
import { PUT as PUT_REACTION } from './[id]/reaction/+server';
import { GET as GET_COMMENTS, POST as POST_COMMENT } from './[id]/comments/+server';
import {
	DELETE as DELETE_COMMENT,
	PATCH as PATCH_COMMENT
} from './[id]/comments/[commentId]/+server';

const mockedGetNewsVisibleToUser = vi.mocked(getNewsVisibleToUser);
const mockedMarkNewsRead = vi.mocked(markNewsRead);
const mockedSetNewsLikeReaction = vi.mocked(setNewsLikeReaction);
const mockedGetNewsComment = vi.mocked(getNewsComment);
const mockedInsertNewsComment = vi.mocked(insertNewsComment);
const mockedListNewsComments = vi.mocked(listNewsComments);
const mockedUpdateNewsComment = vi.mocked(updateNewsComment);
const mockedDeleteNewsComment = vi.mocked(deleteNewsComment);

const trainerLocals = {
	user: {
		kind: 'trainer',
		trainerId: 7
	}
};

const sampleNews = {
	id: 9,
	title: 'Nyhet',
	text: '<p>Text</p>',
	snippet: 'Text',
	writer_id: 2,
	writer_name: 'Writer',
	published_at: null,
	roles: [],
	pinned: false,
	read_at: null,
	like_count: 0,
	has_reacted: false,
	comment_count: 0,
	created_at: '2026-08-25T08:00:00.000Z',
	updated_at: '2026-08-25T08:00:00.000Z'
};

function jsonRequest(path: string, body: Record<string, unknown>) {
	return new Request(`http://localhost${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('news interaction routes', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedGetNewsVisibleToUser.mockResolvedValue(sampleNews as any);
	});

	it('rejects read updates without a trainer session', async () => {
		await expect(
			PUT_READ({ params: { id: '9' }, locals: { user: null } } as any)
		).rejects.toMatchObject({ status: 401 });
		expect(mockedMarkNewsRead).not.toHaveBeenCalled();
	});

	it('does not mark hidden news as read', async () => {
		mockedGetNewsVisibleToUser.mockResolvedValueOnce(null);

		await expect(
			PUT_READ({ params: { id: '9' }, locals: trainerLocals } as any)
		).rejects.toMatchObject({ status: 404 });
		expect(mockedMarkNewsRead).not.toHaveBeenCalled();
	});

	it('marks visible news as read', async () => {
		mockedMarkNewsRead.mockResolvedValueOnce('now' as any);

		const response = await PUT_READ({ params: { id: '9' }, locals: trainerLocals } as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockedMarkNewsRead).toHaveBeenCalledWith(9, 7);
		expect(body.read_at).toBe('now');
	});

	it('does not rewrite read state for already read news', async () => {
		mockedGetNewsVisibleToUser.mockResolvedValueOnce({
			...sampleNews,
			read_at: 'already-read'
		} as any);

		const response = await PUT_READ({ params: { id: '9' }, locals: trainerLocals } as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockedMarkNewsRead).not.toHaveBeenCalled();
		expect(body.read_at).toBe('already-read');
	});

	it('toggles the like reaction for visible news', async () => {
		mockedSetNewsLikeReaction.mockResolvedValueOnce({
			...sampleNews,
			has_reacted: true,
			like_count: 1
		} as any);

		const response = await PUT_REACTION({
			params: { id: '9' },
			locals: trainerLocals,
			request: jsonRequest('/api/news/9/reaction', { active: true })
		} as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockedSetNewsLikeReaction).toHaveBeenCalledWith({
			newsId: 9,
			trainerId: 7,
			active: true
		});
		expect(body.has_reacted).toBe(true);
	});

	it('lists comments only after checking visibility', async () => {
		const comment = {
			id: 1,
			news_item_id: 9,
			user_id: 7,
			user_name: 'Trainer',
			body: 'Bra',
			created_at: '2026-08-25T08:00:00.000Z',
			updated_at: '2026-08-25T08:00:00.000Z',
			can_edit: true,
			can_delete: true
		};
		mockedListNewsComments.mockResolvedValueOnce([comment] as any);

		const response = await GET_COMMENTS({
			params: { id: '9' },
			locals: trainerLocals,
			request: new Request('http://localhost/api/news/9/comments')
		} as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockedGetNewsVisibleToUser).toHaveBeenCalledWith(7, 9);
		expect(body).toEqual([comment]);
	});

	it('validates comment payloads before inserting', async () => {
		await expect(
			POST_COMMENT({
				params: { id: '9' },
				locals: trainerLocals,
				request: jsonRequest('/api/news/9/comments', { body: '   ' })
			} as any)
		).rejects.toMatchObject({ status: 400 });
		expect(mockedInsertNewsComment).not.toHaveBeenCalled();
	});

	it('creates trimmed comments for visible news', async () => {
		const created = {
			id: 2,
			news_item_id: 9,
			user_id: 7,
			user_name: 'Trainer',
			body: 'Bra info',
			created_at: '2026-08-25T08:00:00.000Z',
			updated_at: '2026-08-25T08:00:00.000Z',
			can_edit: true,
			can_delete: true
		};
		mockedInsertNewsComment.mockResolvedValueOnce(created as any);

		const response = await POST_COMMENT({
			params: { id: '9' },
			locals: trainerLocals,
			request: jsonRequest('/api/news/9/comments', { body: '  Bra info  ' })
		} as any);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(mockedInsertNewsComment).toHaveBeenCalledWith({
			newsId: 9,
			trainerId: 7,
			body: 'Bra info'
		});
		expect(body).toEqual(created);
	});

	it('rejects editing someone else comment', async () => {
		mockedGetNewsComment.mockResolvedValueOnce({
			id: 2,
			news_item_id: 9,
			user_id: 4,
			body: 'Nope',
			can_edit: false,
			can_delete: false
		} as any);

		await expect(
			PATCH_COMMENT({
				params: { id: '9', commentId: '2' },
				locals: trainerLocals,
				request: jsonRequest('/api/news/9/comments/2', { body: 'Ändrad' })
			} as any)
		).rejects.toMatchObject({ status: 403 });
		expect(mockedUpdateNewsComment).not.toHaveBeenCalled();
	});

	it('deletes comments when the route permission flag allows it', async () => {
		mockedGetNewsComment.mockResolvedValueOnce({
			id: 2,
			news_item_id: 9,
			user_id: 4,
			body: 'Ta bort',
			can_edit: false,
			can_delete: true
		} as any);

		const response = await DELETE_COMMENT({
			params: { id: '9', commentId: '2' },
			locals: trainerLocals
		} as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.success).toBe(true);
		expect(mockedDeleteNewsComment).toHaveBeenCalledWith(9, 2);
	});
});
