import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

function isOwnerType(value: unknown): value is 'trainer' | 'location' {
	return value === 'trainer' || value === 'location';
}

function toInt(value: unknown): number | null {
	const n = Number(value);
	return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toNumber(value: unknown): number | null {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function fallbackTargetKindId(ownerType: 'trainer' | 'location'): number {
	return ownerType === 'location' ? 2 : 1;
}

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
	const body = await request.json();

	const ownerType = body?.ownerType;
	if (!isOwnerType(ownerType)) {
		return json({ error: 'Invalid ownerType' }, { status: 400 });
	}

	const ownerId = toInt(body?.ownerId);
	const year = toInt(body?.year);
	const goalValue = toNumber(body?.goalValue);
	const targetKindRaw = toInt(body?.targetKindId);
	const targetKindId =
		targetKindRaw && targetKindRaw > 0 ? targetKindRaw : fallbackTargetKindId(ownerType);
	const title = typeof body?.title === 'string' ? body.title : '';
	const description = typeof body?.description === 'string' ? body.description : '';

	if (!ownerId || ownerId <= 0 || !year || year <= 0 || goalValue == null) {
		return json({ error: 'Missing or invalid body fields' }, { status: 400 });
	}

	try {
		await query(
			`INSERT INTO target_goals_year (target_owner_type, target_owner_id, year, target_kind_id, goal_value, title, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (target_owner_type, target_owner_id, year, target_kind_id)
     DO UPDATE SET goal_value=EXCLUDED.goal_value, title=EXCLUDED.title, description=EXCLUDED.description, updated_at=now()`,
			[ownerType, ownerId, year, targetKindId, goalValue, title, description]
		);
		return json({ ok: true });
	} catch (error) {
		console.error('Error saving year goal', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to save year goal' },
			{ status: 500 }
		);
	}
}
