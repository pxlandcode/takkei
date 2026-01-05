import { query } from '$lib/db';

const MANAGE_NEWS_ROLES = ['administrator', 'locationmanager', 'economy'];
const ROLE_WHITELIST = [
	'Administrator',
	'LocationManager',
	'LocationAdmin',
	'BookKeepingAdmin',
	'Economy',
	'Trainer',
	'Educator',
	'EventAdmin'
];

export type NewsRecord = {
	id: number;
	title: string;
	text: string;
	writer_id: number | null;
	writer_name: string | null;
	published_at: string | null;
	roles: string[];
	created_at: string;
	updated_at: string;
};

export function parseRolesText(roles: any): string[] {
	if (!roles || typeof roles !== 'string') return [];
	const trimmed = roles.trim();
	if (!trimmed) return [];

	// Try JSON first (future proof)
	try {
		const parsed = JSON.parse(trimmed);
		if (Array.isArray(parsed)) {
			return Array.from(
				new Set(
					parsed
						.filter((r) => typeof r === 'string')
						.map((r: string) => r.trim())
						.filter(Boolean)
				)
			);
		}
	} catch {
		// ignore
	}

	// Simple YAML array parser ("---\n- Role\n- Other")
	const lines = trimmed
		.replace(/^---\s*/g, '')
		.split('\n')
		.map((line) => line.replace(/^- /, '').trim())
		.filter(Boolean);

	return Array.from(new Set(lines));
}

export function serializeRoles(roles: string[] | null | undefined): string | null {
	if (!roles || roles.length === 0) return null;
	const unique = Array.from(
		new Set(
			roles
				.filter((r) => typeof r === 'string')
				.map((r) => r.trim())
				.filter(Boolean)
		)
	);
	if (unique.length === 0) return null;
	return ['---', ...unique.map((r) => `- ${r}`)].join('\n');
}

export async function getTrainerRoles(trainerId: number): Promise<string[]> {
	const rows = await query<{ name: string | null; role: string | null }>(
		`SELECT roles.name, users.role
		 FROM users
		 LEFT JOIN roles ON roles.user_id = users.id
		 WHERE users.id = $1`,
		[trainerId]
	);

	const collected = new Set<string>();
	for (const row of rows) {
		if (row.name) collected.add(row.name.trim());
		if (row.role) collected.add(row.role.trim());
	}
	return Array.from(collected).filter(Boolean);
}

export function canManageNews(userRoles: string[]): boolean {
	const normalized = userRoles.map((r) => r.toLowerCase());
	return MANAGE_NEWS_ROLES.some((role) => normalized.includes(role.toLowerCase()));
}

function rolePatterns(roles: string[]) {
	return roles?.length > 0 ? roles.map((r) => `%${r}%`) : [];
}

function sanitizeRoles(input: unknown): string[] {
	if (!Array.isArray(input)) return [];
	const cleaned = input
		.filter((r) => typeof r === 'string')
		.map((r) => r.trim())
		.filter(Boolean);

	if (cleaned.length === 0) return [];

	const whitelist = new Set(ROLE_WHITELIST.map((r) => r.toLowerCase()));
	const unique = Array.from(
		new Set(
			cleaned.filter((r) => (ROLE_WHITELIST.length ? whitelist.has(r.toLowerCase()) : true))
		)
	);
	return unique;
}

export async function listNewsVisibleToUser(trainerId: number, opts?: {
	limit?: number;
	offset?: number;
	recentOnly?: boolean;
}): Promise<NewsRecord[]> {
	const roles = await getTrainerRoles(trainerId);
	const patterns = rolePatterns(roles);
	const limit = Number.isFinite(opts?.limit) ? Math.max(1, Number(opts?.limit)) : 10;
	const offset = Number.isFinite(opts?.offset) ? Math.max(0, Number(opts?.offset)) : 0;

	const params: any[] = [patterns, limit, offset];
	let where = `(n.roles IS NULL OR n.roles = '' OR n.roles LIKE ANY($1))`;
	if (opts?.recentOnly) {
		where += ` AND n.created_at > NOW() - INTERVAL '1 month'`;
	}

	const rows = await query(
		`
		SELECT
			n.*,
			COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '') AS writer_name
		FROM news_items n
		LEFT JOIN users u ON u.id = n.writer_id
		WHERE ${where}
		ORDER BY n.created_at DESC
		LIMIT $2 OFFSET $3
	`,
		params
	);

	return rows.map(toNewsRecord);
}

export async function getNewsVisibleToUser(trainerId: number, newsId: number): Promise<NewsRecord | null> {
	const roles = await getTrainerRoles(trainerId);
	const patterns = rolePatterns(roles);
	const [row] = await query(
		`
		SELECT
			n.*,
			COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '') AS writer_name
		FROM news_items n
		LEFT JOIN users u ON u.id = n.writer_id
		WHERE n.id = $1
		  AND (n.roles IS NULL OR n.roles = '' OR n.roles LIKE ANY($2))
		LIMIT 1
	`,
		[newsId, patterns]
	);
	return row ? toNewsRecord(row) : null;
}

export async function insertNews({
	title,
	text,
	writerId,
	roles
}: {
	title: string;
	text: string;
	writerId: number;
	roles: string[];
}): Promise<NewsRecord> {
	const rolesText = serializeRoles(sanitizeRoles(roles));
	const [row] = await query(
		`
		INSERT INTO news_items (title, text, writer_id, published_at, roles, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), $4, NOW(), NOW())
		RETURNING *
	`,
		[title, text, writerId, rolesText]
	);

	const [withWriter] = await query(
		`SELECT n.*, COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '') AS writer_name
		 FROM news_items n
		 LEFT JOIN users u ON u.id = n.writer_id
		 WHERE n.id = $1`,
		[row.id]
	);

	return toNewsRecord(withWriter ?? row);
}

export async function updateNews({
	id,
	title,
	text,
	roles
}: {
	id: number;
	title: string;
	text: string;
	roles: string[];
}): Promise<NewsRecord | null> {
	const rolesText = serializeRoles(sanitizeRoles(roles));
	const rows = await query(
		`
		UPDATE news_items
		SET title = $1,
			text = $2,
			roles = $3,
			updated_at = NOW()
		WHERE id = $4
		RETURNING *
	`,
		[title, text, rolesText, id]
	);
	const updated = rows[0];
	if (!updated) return null;

	const [withWriter] = await query(
		`SELECT n.*, COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '') AS writer_name
		 FROM news_items n
		 LEFT JOIN users u ON u.id = n.writer_id
		 WHERE n.id = $1`,
		[id]
	);

	return toNewsRecord(withWriter ?? updated);
}

export async function deleteNews(id: number) {
	await query(`DELETE FROM news_items WHERE id = $1`, [id]);
}

export async function findRecipientsByRoles(roles: string[]): Promise<
	{ id: number; email: string | null; name: string | null }[]
> {
	const baseQuery = `
		SELECT DISTINCT users.id, users.email, (users.firstname || ' ' || users.lastname) AS name
		FROM users
		JOIN roles ON roles.user_id = users.id
		WHERE users.active = true
	`;

	if (!roles || roles.length === 0) {
		const res = await query(baseQuery);
		return res;
	}

	const res = await query(`${baseQuery} AND roles.name = ANY($1::text[])`, [roles]);
	return res;
}

export function stripHtmlToText(html: string): string {
	return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function toNewsRecord(row: any): NewsRecord {
	return {
		id: row.id,
		title: row.title ?? '',
		text: row.text ?? '',
		writer_id: row.writer_id ?? null,
		writer_name: row.writer_name?.trim() || null,
		published_at: row.published_at ?? null,
		roles: parseRolesText(row.roles),
		created_at: row.created_at,
		updated_at: row.updated_at
	};
}

export function sanitizeNewsRoles(input: unknown): string[] {
	return sanitizeRoles(input);
}
