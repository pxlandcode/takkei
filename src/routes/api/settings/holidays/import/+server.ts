import type { RequestHandler } from '@sveltejs/kit';
import { createRequire } from 'node:module';
import { query } from '$lib/db';
import { isAdministrator, json, resolveUserWithRoles } from '../../helpers';
import { mapHolidayRow, type HolidayRow } from '../helpers';

const require = createRequire(import.meta.url);
type SwedishHolidaysModule = typeof import('swedish-holidays/dist/index.js');
const { getHolidays } = require('swedish-holidays/dist/index.js') as SwedishHolidaysModule;

const MIN_YEAR = 1900;
const MAX_YEAR = 8702; // library limit according to swedish-holidays docs

type RawSwedishHoliday = {
	name?: string;
	date?: string;
};

type NormalizedHoliday = {
	name: string;
	date: string;
	description: string | null;
};

type ImportMeta = {
	year: number;
	sourceTotal: number;
	normalized: number;
	inserted: number;
	skippedExisting: number;
	skippedInvalid: number;
};

function normalizeDate(value: unknown): string | null {
	if (!value) return null;
	const parsed = new Date(value as string);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}
	return parsed.toISOString().slice(0, 10);
}

function normalizeHoliday(holiday: RawSwedishHoliday): NormalizedHoliday | null {
	const name = typeof holiday?.name === 'string' ? holiday.name.trim() : '';
	const date = normalizeDate(holiday?.date);

	if (!name || !date) {
		return null;
	}

	return {
		name,
		date,
		description: null
	};
}

function parseYear(input: unknown): { year: number } | { error: string } {
	const raw =
		typeof input === 'number'
			? input
			: typeof input === 'string'
				? Number.parseInt(input, 10)
				: Number.NaN;

	if (!Number.isFinite(raw)) {
		return { error: 'Ange ett giltigt årtal.' };
	}

	if (raw < MIN_YEAR || raw > MAX_YEAR) {
		return {
			error: `År måste vara mellan ${MIN_YEAR} och ${MAX_YEAR}.`
		};
	}

	return { year: raw };
}

function buildInsertStatement(records: NormalizedHoliday[]) {
	const values: Array<string | null> = [];
	const placeholders: string[] = [];

	records.forEach((holiday, index) => {
		const baseIndex = index * 3;
		placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`);
		values.push(holiday.name, holiday.date, holiday.description);
	});

	const sql = `WITH new_values (name, date, description) AS (
                                VALUES ${placeholders.join(', ')}
                        ),
                        deduped AS (
                                SELECT name, date::date AS date, description
                                FROM new_values nv
                                WHERE NOT EXISTS (
                                        SELECT 1
                                        FROM holidays h
                                        WHERE h.date::date = nv.date::date
                                )
                        )
                        INSERT INTO holidays (name, date, description, created_at, updated_at)
                        SELECT name, date, description, NOW(), NOW()
                        FROM deduped
                        RETURNING id, name, date::date AS date, description, created_at, updated_at`;

	return { sql, values };
}

function getExistingDateSet(rows: HolidayRow[]) {
	const dates = new Set<string>();
	for (const row of rows) {
		const normalized = typeof row.date === 'string' ? row.date : normalizeDate(row.date);
		if (normalized) {
			dates.add(normalized);
		}
	}
	return dates;
}

export const POST: RequestHandler = async ({ locals, request }) => {
	const { authUser, roleAwareUser } = await resolveUserWithRoles(locals);
	if (!authUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!isAdministrator(roleAwareUser)) {
		return new Response('Forbidden', { status: 403 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch (error) {
		console.error('Invalid JSON payload for holiday import', error);
		return json({ errors: { _form: 'Ogiltig begäran' } }, 400);
	}

	const parsedYear = parseYear(body.year);
	if ('error' in parsedYear) {
		return json({ errors: { year: parsedYear.error } }, 400);
	}

	const year = parsedYear.year;
	const rangeStart = `${year}-01-01`;
	const rangeEnd = `${year}-12-31`;

	let fetched: RawSwedishHoliday[] = [];
	try {
		fetched = getHolidays(year) ?? [];
	} catch (error) {
		console.error('Failed to fetch swedish holidays for import', error);
		return json({ errors: { year: 'Kunde inte hämta helgdagar för valt år.' } }, 400);
	}

	const normalized: NormalizedHoliday[] = [];
	let skippedInvalid = 0;
	const seenDates = new Set<string>();

	for (const holiday of fetched) {
		const normalizedHoliday = normalizeHoliday(holiday);
		if (!normalizedHoliday) {
			skippedInvalid += 1;
			continue;
		}

		if (seenDates.has(normalizedHoliday.date)) {
			continue;
		}

		seenDates.add(normalizedHoliday.date);
		normalized.push(normalizedHoliday);
	}

	let existingRows: HolidayRow[] = [];
	try {
		existingRows = await query<HolidayRow>(
			`SELECT id, name, date::date AS date, description, created_at, updated_at
                         FROM holidays
                         WHERE date::date BETWEEN $1::date AND $2::date`,
			[rangeStart, rangeEnd]
		);
	} catch (error) {
		console.error('Failed to load current holidays before import', error);
		return new Response('Internal Server Error', { status: 500 });
	}

	const existingDates = getExistingDateSet(existingRows);
	const toInsert = normalized.filter((holiday) => !existingDates.has(holiday.date));
	const skippedExisting = normalized.length - toInsert.length;

	const metaBase: ImportMeta = {
		year,
		sourceTotal: fetched.length,
		normalized: normalized.length,
		inserted: 0,
		skippedExisting,
		skippedInvalid
	};

	if (toInsert.length === 0) {
		return json({ data: [], meta: metaBase });
	}

	const { sql, values } = buildInsertStatement(toInsert);

	try {
		const rows = await query<HolidayRow>(sql, values);
		return json({
			data: rows.map(mapHolidayRow),
			meta: { ...metaBase, inserted: rows.length }
		});
	} catch (error) {
		console.error('Failed to insert imported holidays', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};
