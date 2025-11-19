import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

export async function GET({ url }) {
	const ownerType = url.searchParams.get('ownerType') as 'trainer' | 'location';
	const ownerId = Number(url.searchParams.get('ownerId'));
	const year = Number(url.searchParams.get('year'));
	const monthRaw = url.searchParams.get('month'); // optional
	const month = monthRaw != null ? Number(monthRaw) : null;
	const targetKindId = Number(url.searchParams.get('targetKindId') || 1);

	if (!ownerType || !ownerId || !year) {
		return json({ error: 'Missing required params: ownerType, ownerId, year' }, { status: 400 });
	}
	if (month != null && (month < 1 || month > 12)) {
		return json({ error: 'Invalid month (1..12)' }, { status: 400 });
	}

	// Fetch the YEAR goal once (useful in both modes)
	const yearRows = await query(
		`SELECT goal_value
       FROM target_goals_year
      WHERE target_owner_type=$1 AND target_owner_id=$2 AND year=$3 AND target_kind_id=$4`,
		[ownerType, ownerId, year, targetKindId]
	);
	const yg = yearRows[0]?.goal_value;
	const yearGoal = yg == null || Number.isNaN(Number(yg)) ? null : Math.trunc(Number(yg));

	// --- SINGLE MODE: month provided -> return that month + yearGoal
	if (month != null) {
		const mRows = await query(
			`SELECT goal_value
         FROM target_goals_month
        WHERE target_owner_type=$1 AND target_owner_id=$2 AND year=$3 AND month=$4 AND target_kind_id=$5`,
			[ownerType, ownerId, year, month, targetKindId]
		);
		const mg = mRows[0]?.goal_value;
		const monthGoal = mg == null || Number.isNaN(Number(mg)) ? null : Math.trunc(Number(mg));

		return json({ yearGoal, monthGoal });
	}

	// --- LIST MODE: no month -> return all months + yearGoal
	const rows = await query(
		`SELECT month, goal_value, description
       FROM target_goals_month
      WHERE target_owner_type=$1 AND target_owner_id=$2 AND year=$3 AND target_kind_id=$4
      ORDER BY month`,
		[ownerType, ownerId, year, targetKindId]
	);

	const months = rows.map((r: any) => {
		const desc = String(r.description ?? '').toLowerCase();
		const isAnchor = desc === 'anchor' || desc === '';
		return {
			month: Number(r.month),
			goal_value:
				r.goal_value == null || Number.isNaN(Number(r.goal_value))
					? null
					: Math.trunc(Number(r.goal_value)),
			is_anchor: isAnchor
		};
	});

	return json({ yearGoal, months });
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
		description = '',
		isAnchor = true
	} = await request.json();

	if (!ownerType || !ownerId || !year || !month) {
		return json({ error: 'Missing required body fields' }, { status: 400 });
	}

	const normalizedDescription =
		description && description.trim().length > 0
			? description
			: isAnchor
				? 'anchor'
				: 'auto';

	await query(
		`INSERT INTO target_goals_month (target_owner_type, target_owner_id, year, month, target_kind_id, goal_value, title, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (target_owner_type, target_owner_id, year, month, target_kind_id)
     DO UPDATE
        SET goal_value=EXCLUDED.goal_value,
            title=EXCLUDED.title,
            description=EXCLUDED.description,
            updated_at=now()`,
		[ownerType, ownerId, year, month, targetKindId, goalValue, title, normalizedDescription]
	);
	return json({ ok: true });
}
