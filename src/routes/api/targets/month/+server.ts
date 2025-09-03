import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

export async function GET({ url }) {
	const ownerType = url.searchParams.get('ownerType') as 'trainer' | 'location';
	const ownerId = Number(url.searchParams.get('ownerId'));
	const year = Number(url.searchParams.get('year'));
	const month = Number(url.searchParams.get('month')); // 1..12
	const kind = Number(url.searchParams.get('targetKindId') || 1);

	if (!ownerType || !ownerId || !year || !month) {
		return json({ error: 'Missing required params' }, { status: 400 });
	}

	// Year goal
	const yearRows = await query(
		`SELECT goal_value
       FROM target_goals_year
       WHERE target_owner_type=$1 AND target_owner_id=$2 AND year=$3 AND target_kind_id=$4`,
		[ownerType, ownerId, year, kind]
	);
	const yearRaw = yearRows[0]?.goal_value;
	const yearGoal =
		yearRaw == null || Number.isNaN(Number(yearRaw)) ? null : Math.trunc(Number(yearRaw));

	// Month goal (optional row)
	const monthRows = await query(
		`SELECT goal_value
       FROM target_goals_month
       WHERE target_owner_type=$1 AND target_owner_id=$2 AND year=$3 AND month=$4 AND target_kind_id=$5`,
		[ownerType, ownerId, year, month, kind]
	);
	const monthRaw = monthRows[0]?.goal_value;
	const monthGoal =
		monthRaw == null || Number.isNaN(Number(monthRaw)) ? null : Math.trunc(Number(monthRaw));

	return json({ yearGoal, monthGoal });
}

export async function POST({ request }) {
	const {
		ownerType,
		ownerId,
		year,
		month,
		targetKindId,
		goalValue,
		title = '',
		description = ''
	} = await request.json();

	if (!ownerType || !ownerId || !year || !month || !targetKindId) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	await query(
		`INSERT INTO target_goals_month
           (target_owner_type, target_owner_id, year, month, target_kind_id, goal_value, title, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (target_owner_type, target_owner_id, year, month, target_kind_id)
         DO UPDATE SET goal_value=EXCLUDED.goal_value,
                       title=EXCLUDED.title,
                       description=EXCLUDED.description,
                       updated_at=now()`,
		[ownerType, ownerId, year, month, targetKindId, goalValue, title, description]
	);

	return json({ ok: true });
}
