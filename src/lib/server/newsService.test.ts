import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db', () => ({
	query: vi.fn()
}));

import { query } from '$lib/db';
import {
	canDeleteNewsRecord,
	canEditNewsRecord,
	listNewsVisibleToUser,
	newsSnippet,
	sanitizeNewsCommentBody
} from './newsService';

const mockedQuery = vi.mocked(query);

describe('news service', () => {
	beforeEach(() => {
		mockedQuery.mockReset();
	});

	it('maps news rows with like counts and pinned ordering', async () => {
		mockedQuery.mockResolvedValueOnce([{ name: 'Trainer', role: null }]);
		mockedQuery.mockResolvedValueOnce([
			{
				id: '12',
				title: 'Veckonytt',
				text: '<p>Viktig intern info &amp; schema</p>',
				writer_id: 4,
				writer_name: ' Ada Lovelace ',
				published_at: '2026-08-25T08:00:00.000Z',
				roles: '---\n- Trainer',
				pinned: true,
				read_at: null,
				like_count: '2',
				has_reacted: true,
				comment_count: '3',
				created_at: '2026-08-25T08:00:00.000Z',
				updated_at: '2026-08-25T08:00:00.000Z'
			}
		]);

		const result = await listNewsVisibleToUser(7, { limit: 20 });

		expect(mockedQuery).toHaveBeenCalledTimes(2);
		expect(mockedQuery.mock.calls[1][0]).toContain('ORDER BY COALESCE(n.pinned, FALSE) DESC');
		expect(mockedQuery.mock.calls[1][0]).toContain('OR n.writer_id = $2 OR $3 = TRUE');
		expect(mockedQuery.mock.calls[1][1]).toEqual([['%Trainer%'], 7, false, 20, 0]);
		expect(result[0]).toMatchObject({
			id: 12,
			title: 'Veckonytt',
			snippet: 'Viktig intern info & schema',
			writer_name: 'Ada Lovelace',
			roles: ['Trainer'],
			pinned: true,
			read_at: null,
			like_count: 2,
			has_reacted: true,
			comment_count: 3
		});
	});

	it('adds an unread filter without changing the array response contract', async () => {
		mockedQuery.mockResolvedValueOnce([{ name: 'Trainer', role: null }]);
		mockedQuery.mockResolvedValueOnce([]);

		await listNewsVisibleToUser(7, { filter: 'unread' });

		expect(mockedQuery.mock.calls[1][0]).toContain('unread_reads');
		expect(mockedQuery.mock.calls[1][1]).toEqual([['%Trainer%'], 7, false, 10, 0]);
	});

	it('allows admins to edit/delete any news and managers only their own', () => {
		const news = { writer_id: 4 };

		expect(canEditNewsRecord(news, 7, ['Administrator'])).toBe(true);
		expect(canDeleteNewsRecord(news, 7, ['Administrator'])).toBe(true);
		expect(canEditNewsRecord(news, 4, ['LocationManager'])).toBe(true);
		expect(canDeleteNewsRecord(news, 4, ['Economy'])).toBe(true);
		expect(canEditNewsRecord(news, 7, ['LocationManager'])).toBe(false);
		expect(canDeleteNewsRecord(news, 7, ['Economy'])).toBe(false);
	});

	it('validates and trims plain-text comments', () => {
		expect(sanitizeNewsCommentBody('  Bra info  ')).toEqual({
			body: 'Bra info',
			error: null
		});
		expect(sanitizeNewsCommentBody('   ').error).toBe('Kommentar krävs');
		expect(sanitizeNewsCommentBody('x'.repeat(2001)).error).toContain('max 2000');
	});

	it('builds short snippets from quill html', () => {
		expect(newsSnippet('<p>Hej&nbsp;<strong>teamet</strong></p>', 20)).toBe('Hej teamet');
		expect(newsSnippet(`<p>${'a'.repeat(30)}</p>`, 10)).toBe('aaaaaaaaa…');
	});
});
