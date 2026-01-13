import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

function formatDateLocal(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function parseDateYMD(value: string): Date | null {
	if (!value) return null;
	const [y, m, d] = value.split('-').map(Number);
	if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
	return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

function getWeekFramesForMonth(year: number, month: number) {
	const start = new Date(year, month - 1, 1);
	const end = new Date(year, month, 0);

	const seed = new Date(start);
	const mondayOffset = (seed.getDay() + 6) % 7;
	seed.setDate(seed.getDate() - mondayOffset);

	const frames: { start: Date; end: Date }[] = [];
	while (seed <= end) {
		const ws = new Date(Math.max(seed.getTime(), start.getTime()));
		const we = new Date(seed);
		we.setDate(we.getDate() + 6);
		const weClamped = new Date(Math.min(we.getTime(), end.getTime()));
		frames.push({ start: ws, end: weClamped });
		seed.setDate(seed.getDate() + 7);
	}
	return frames;
}

export async function GET({ url }) {
	const ownerType = url.searchParams.get('ownerType') as 'trainer' | 'location';
	const ownerId = Number(url.searchParams.get('ownerId'));
	const year = Number(url.searchParams.get('year'));
	const month = Number(url.searchParams.get('month'));
	const kind = Number(url.searchParams.get('targetKindId') || 1);
	const rows = await query(
		`SELECT week_start, week_end, goal_value, COALESCE(is_anchor, false) as is_anchor
     FROM target_goals_week
     WHERE target_owner_type=$1 AND target_owner_id=$2 AND year=$3 AND month=$4 AND target_kind_id=$5
     ORDER BY week_start`,
		[ownerType, ownerId, year, month, kind]
	);

	const frames = getWeekFramesForMonth(year, month);
	const correctKeys = new Set(
		frames.map((f) => `${formatDateLocal(f.start)}|${formatDateLocal(f.end)}`)
	);
	const legacyKeys = new Set(
		frames.map(
			(f) => `${formatDateLocal(addDays(f.start, -1))}|${formatDateLocal(addDays(f.end, -1))}`
		)
	);

	const rowKeys = rows.map((r: any) => `${String(r.week_start)}|${String(r.week_end)}`);
	const legacyMatches = rowKeys.filter((k: string) => legacyKeys.has(k)).length;
	const correctMatches = rowKeys.filter((k: string) => correctKeys.has(k)).length;

	// Auto-migrate legacy Sun–Sat (UTC-shifted) ranges to local Mon–Sun when detected.
	if (legacyMatches > 0 && correctMatches === 0) {
		const updates: Promise<any>[] = [];
		const migratedRows = rows.map((row: any) => {
			const oldStart = String(row.week_start);
			const oldEnd = String(row.week_end);
			const key = `${oldStart}|${oldEnd}`;
			if (!legacyKeys.has(key)) return row;

			const parsedStart = parseDateYMD(oldStart);
			const parsedEnd = parseDateYMD(oldEnd);
			if (!parsedStart || !parsedEnd) return row;

			const newStart = formatDateLocal(addDays(parsedStart, 1));
			const newEnd = formatDateLocal(addDays(parsedEnd, 1));

			updates.push(
				query(
					`UPDATE target_goals_week
					 SET week_start=$1, week_end=$2, updated_at=now()
					 WHERE target_owner_type=$3 AND target_owner_id=$4 AND year=$5 AND month=$6 AND target_kind_id=$7
					   AND week_start=$8 AND week_end=$9`,
					[newStart, newEnd, ownerType, ownerId, year, month, kind, oldStart, oldEnd]
				)
			);

			return { ...row, week_start: newStart, week_end: newEnd };
		});

		if (updates.length) await Promise.all(updates);
		return json(migratedRows);
	}

	return json(rows);
}

export async function POST({ request }) {
	const {
		ownerType,
		ownerId,
		year,
		month,
		week_start,
		week_end,
		targetKindId,
		goalValue,
		isAnchor = false,
		title = '',
		description = ''
	} = await request.json();
	await query(
		`INSERT INTO target_goals_week (target_owner_type, target_owner_id, year, month, week_start, week_end, target_kind_id, goal_value, is_anchor, title, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (target_owner_type, target_owner_id, week_start, target_kind_id, month)
     DO UPDATE SET goal_value=EXCLUDED.goal_value, is_anchor=EXCLUDED.is_anchor, title=EXCLUDED.title, description=EXCLUDED.description, updated_at=now()`,
		[
			ownerType,
			ownerId,
			year,
			month,
			week_start,
			week_end,
			targetKindId,
			goalValue,
			isAnchor,
			title,
			description
		]
	);
	return json({ ok: true });
}
