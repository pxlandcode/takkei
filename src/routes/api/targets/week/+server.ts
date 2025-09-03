import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

export async function GET({ url }) {
	const ownerType = url.searchParams.get('ownerType') as 'trainer' | 'location';
	const ownerId = Number(url.searchParams.get('ownerId'));
	const year = Number(url.searchParams.get('year'));
	const month = Number(url.searchParams.get('month'));
	const kind = Number(url.searchParams.get('targetKindId') || 1);
	const rows = await query(
		`SELECT week_start, week_end, goal_value
     FROM target_goals_week
     WHERE target_owner_type=$1 AND target_owner_id=$2 AND year=$3 AND month=$4 AND target_kind_id=$5
     ORDER BY week_start`,
		[ownerType, ownerId, year, month, kind]
	);
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
		title = '',
		description = ''
	} = await request.json();
	await query(
		`INSERT INTO target_goals_week (target_owner_type, target_owner_id, year, month, week_start, week_end, target_kind_id, goal_value, title, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (target_owner_type, target_owner_id, week_start, target_kind_id, month)
     DO UPDATE SET goal_value=EXCLUDED.goal_value, title=EXCLUDED.title, description=EXCLUDED.description, updated_at=now()`,
		[
			ownerType,
			ownerId,
			year,
			month,
			week_start,
			week_end,
			targetKindId,
			goalValue,
			title,
			description
		]
	);
	return json({ ok: true });
}
