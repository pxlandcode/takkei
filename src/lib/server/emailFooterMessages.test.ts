import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db', () => ({
	query: vi.fn()
}));

import { query } from '$lib/db';
import {
	FALLBACK_EMAIL_FOOTER_MESSAGES,
	getActiveEmailFooterLinesForEmail,
	mapEmailFooterMessageRow,
	splitEmailFooterMessageLines,
	validateEmailFooterMessagePayload
} from './emailFooterMessages';

const mockedQuery = vi.mocked(query);

describe('email footer messages', () => {
	beforeEach(() => {
		mockedQuery.mockReset();
	});

	it('validates and normalizes payloads', () => {
		expect(validateEmailFooterMessagePayload({ message: '  Hej footer  ' })).toEqual({
			errors: {},
			values: {
				message: 'Hej footer',
				active: true
			}
		});

		expect(validateEmailFooterMessagePayload({ message: '   ', active: false })).toEqual({
			errors: { message: 'Meddelande krävs' },
			values: {
				message: '',
				active: false
			}
		});
	});

	it('maps rows and splits multiline messages', () => {
		expect(
			mapEmailFooterMessageRow({
				id: 7,
				message: ' Rad 1 \n\n Rad 2 ',
				active: true,
				created_at: '2026-08-24T10:00:00.000Z',
				updated_at: null
			})
		).toEqual({
			id: 7,
			message: 'Rad 1 \n\n Rad 2',
			active: true,
			createdAt: '2026-08-24T10:00:00.000Z',
			updatedAt: null
		});

		expect(splitEmailFooterMessageLines(' Rad 1 \n\n Rad 2 ')).toEqual(['Rad 1', 'Rad 2']);
	});

	it('loads active footer lines from the database', async () => {
		mockedQuery.mockResolvedValueOnce([
			{
				id: 1,
				message: 'Första raden\nAndra raden',
				active: true,
				created_at: '2026-08-24T10:00:00.000Z',
				updated_at: '2026-08-24T10:00:00.000Z'
			}
		]);

		await expect(getActiveEmailFooterLinesForEmail()).resolves.toEqual([
			'Första raden',
			'Andra raden'
		]);
	});

	it('returns no footer lines when no active messages exist', async () => {
		mockedQuery.mockResolvedValueOnce([]);

		await expect(getActiveEmailFooterLinesForEmail()).resolves.toBeNull();
	});

	it('falls back when the table cannot be read', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		mockedQuery.mockRejectedValueOnce(new Error('relation does not exist'));

		const lines = await getActiveEmailFooterLinesForEmail();
		const fallbackLineSets = FALLBACK_EMAIL_FOOTER_MESSAGES.map(splitEmailFooterMessageLines);

		expect(fallbackLineSets).toContainEqual(lines);
		warnSpy.mockRestore();
	});
});
