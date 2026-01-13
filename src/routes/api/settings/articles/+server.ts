import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
import { resolveRoleAwareUser } from '$lib/server/roleAwareUser';

const ARTICLE_ROLES = ['Administrator', 'Economy', 'Economy Admin'];

function hasArticlesAccess(roleAwareUser: any) {
	return hasRole(ARTICLE_ROLES, roleAwareUser as any);
}

function parseShowInactive(value: string | null) {
	return value === 'yes';
}

function normalizeText(value: unknown) {
	if (value === null || value === undefined) return null;
	const trimmed = String(value).trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizePrice(value: unknown) {
	const trimmed = normalizeText(value);
	if (!trimmed) return null;
	return trimmed.replace(',', '.');
}

function normalizeSessions(value: unknown) {
	const trimmed = normalizeText(value);
	if (!trimmed) return null;
	return trimmed;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (normalized === 'true') return true;
		if (normalized === 'false') return false;
	}
	return fallback;
}

async function insertAuditLog({
	modelId,
	userId,
	params
}: {
	modelId: number;
	userId: number;
	params: Record<string, unknown>;
}) {
	await query(
		`INSERT INTO audit_log (audit_model_name, audit_model_id, user_id, params, created_at, updated_at, format)
		 VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)`,
		['articles', modelId, userId, JSON.stringify(params), 'html']
	);
}

function trainerIdFromUser(authUser: any) {
	if (!authUser || authUser.kind !== 'trainer') return null;
	const trainerId = authUser.trainerId ?? authUser.trainer_id ?? null;
	return typeof trainerId === 'number' ? trainerId : null;
}

type ArticleRow = {
	id: number;
	name: string;
	price: string;
	sessions: number | null;
	validity_start_date: string | null;
	validity_end_date: string | null;
	kind: string | null;
	active: boolean;
	packages_count: number;
	memberships_count: number;
};

export const GET: RequestHandler = async ({ locals, url }) => {
	const roleAwareUser = await resolveRoleAwareUser(locals.user ?? null);
	if (!roleAwareUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!hasArticlesAccess(roleAwareUser)) {
		return new Response('No permission: articles', { status: 403 });
	}

	const showInactive = parseShowInactive(url.searchParams.get('show_inactive'));

	try {
		const rows = await query<ArticleRow>(
			`SELECT a.id,
				a.name,
				a.price,
				a.sessions,
				a.validity_start_date,
				a.validity_end_date,
				a.kind,
				a.active,
				COALESCE(p.packages_count, 0) AS packages_count,
				COALESCE(m.memberships_count, 0) AS memberships_count
			 FROM articles a
			 LEFT JOIN (
				SELECT article_id, COUNT(*)::int AS packages_count
				FROM packages
				GROUP BY article_id
			 ) p ON p.article_id = a.id
			 LEFT JOIN (
				SELECT article_id, COUNT(*)::int AS memberships_count
				FROM memberships
				GROUP BY article_id
			 ) m ON m.article_id = a.id
			 WHERE ($1::boolean OR a.active = true)
			 ORDER BY a.sessions ASC, a.kind ASC, a.name ASC`,
			[showInactive]
		);

		return json(rows);
	} catch (error) {
		console.error('Failed to fetch articles', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const roleAwareUser = await resolveRoleAwareUser(locals.user ?? null);
	if (!roleAwareUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!hasArticlesAccess(roleAwareUser)) {
		return new Response('No permission: articles', { status: 403 });
	}

	const trainerId = trainerIdFromUser(locals.user);
	if (typeof trainerId !== 'number') {
		return new Response('Unauthorized', { status: 401 });
	}

	let body: Record<string, unknown> = {};
	try {
		body = await request.json();
	} catch (error) {
		console.error('Invalid article payload', error);
		return json({ error: 'Ogiltig begäran' }, { status: 400 });
	}

	const name = normalizeText(body.name);
	if (!name) {
		return json({ errors: { name: 'Namn krävs' } }, { status: 400 });
	}

	const payload = {
		name,
		price: normalizePrice(body.price) ?? '0',
		sessions: normalizeSessions(body.sessions),
		validity_start_date: normalizeText(body.validity_start_date),
		validity_end_date: normalizeText(body.validity_end_date),
		kind: normalizeText(body.kind),
		active: normalizeBoolean(body.active, true)
	};

	try {
		const [created] = await query<ArticleRow>(
			`INSERT INTO articles (
				name,
				price,
				sessions,
				validity_start_date,
				validity_end_date,
				kind,
				active,
				created_at,
				updated_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
			RETURNING id, name, price, sessions, validity_start_date, validity_end_date, kind, active,
				0::int AS packages_count, 0::int AS memberships_count`,
			[
				payload.name,
				payload.price,
				payload.sessions,
				payload.validity_start_date,
				payload.validity_end_date,
				payload.kind,
				payload.active
			]
		);

		if (!created) {
			return new Response('Internal Server Error', { status: 500 });
		}

		await insertAuditLog({ modelId: created.id, userId: trainerId, params: payload });

		return json(created, { status: 201 });
	} catch (error) {
		console.error('Failed to create article', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};
