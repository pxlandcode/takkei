import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

export async function GET({ url }) {
	const ownerType = url.searchParams.get('ownerType') as 'trainer' | 'location';
	const ownerId = Number(url.searchParams.get('ownerId'));
	const year = Number(url.searchParams.get('year'));
	const kind = Number(url.searchParams.get('targetKindId') || 1);

	const rows = await query(
		`SELECT goal_value
     FROM target_goals_year
     WHERE target_owner_type=$1 AND target_owner_id=$2 AND year=$3 AND target_kind_id=$4`,
		[ownerType, ownerId, year, kind]
	);

	const raw = rows[0]?.goal_value;
	const value = raw == null || Number.isNaN(Number(raw)) ? null : Math.trunc(Number(raw));

	return json({ value });
}

export async function POST({ request }) {
	const {
		ownerType,
		ownerId,
		year,
		targetKindId,
		goalValue,
		title = '',
		description = ''
	} = await request.json();
	await query(
		`INSERT INTO target_goals_year (target_owner_type, target_owner_id, year, target_kind_id, goal_value, title, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (target_owner_type, target_owner_id, year, target_kind_id)
     DO UPDATE SET goal_value=EXCLUDED.goal_value, title=EXCLUDED.title, description=EXCLUDED.description, updated_at=now()`,
		[ownerType, ownerId, year, targetKindId, goalValue, title, description]
	);
	return json({ ok: true });
}
