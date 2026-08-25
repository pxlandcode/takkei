import { query } from '$lib/db';

const MANAGE_NEWS_ROLES = ['administrator', 'locationmanager', 'economy'];
const ADMIN_NEWS_ROLES = ['administrator'];
const NEWS_REACTION_TYPE = 'like';
export const NEWS_COMMENT_MAX_LENGTH = 2000;

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

export type NewsFilter = 'all' | 'unread' | 'pinned';

export type NewsRecord = {
	id: number;
	title: string;
	text: string;
	snippet: string;
	writer_id: number | null;
	writer_name: string | null;
	published_at: string | null;
	roles: string[];
	pinned: boolean;
	read_at: string | null;
	like_count: number;
	has_reacted: boolean;
	comment_count: number;
	created_at: string;
	updated_at: string;
};

export type NewsCommentRecord = {
	id: number;
	news_item_id: number;
	user_id: number;
	user_name: string | null;
	body: string;
	created_at: string;
	updated_at: string;
	can_edit: boolean;
	can_delete: boolean;
};

type ListNewsOptions = {
	limit?: number;
	offset?: number;
	recentOnly?: boolean;
	filter?: NewsFilter;
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

export function canAdministrateNews(userRoles: string[]): boolean {
	const normalized = userRoles.map((r) => r.toLowerCase());
	return ADMIN_NEWS_ROLES.some((role) => normalized.includes(role.toLowerCase()));
}

export function canEditNewsRecord(
	news: Pick<NewsRecord, 'writer_id'>,
	trainerId: number,
	userRoles: string[]
) {
	return (
		canAdministrateNews(userRoles) || (news.writer_id === trainerId && canManageNews(userRoles))
	);
}

export function canDeleteNewsRecord(
	news: Pick<NewsRecord, 'writer_id'>,
	trainerId: number,
	userRoles: string[]
) {
	return (
		canAdministrateNews(userRoles) || (news.writer_id === trainerId && canManageNews(userRoles))
	);
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
		new Set(cleaned.filter((r) => (ROLE_WHITELIST.length ? whitelist.has(r.toLowerCase()) : true)))
	);
	return unique;
}

function parseNewsFilter(value: unknown): NewsFilter {
	if (value === 'unread' || value === 'pinned') return value;
	return 'all';
}

function visibilityClause(patternParam: string, trainerParam: string, adminParam: string) {
	return `(n.roles IS NULL OR n.roles = '' OR n.roles LIKE ANY(${patternParam}) OR n.writer_id = ${trainerParam} OR ${adminParam} = TRUE)`;
}

function newsSelectSql(viewerParam: string) {
	return `
		SELECT
			n.*,
			COALESCE(n.pinned, FALSE) AS pinned,
			COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '') AS writer_name,
			my_read.read_at,
			COALESCE(like_counts.like_count, 0)::int AS like_count,
			(my_reaction.news_item_id IS NOT NULL) AS has_reacted,
			COALESCE(comment_counts.comment_count, 0)::int AS comment_count
		FROM news_items n
		LEFT JOIN users u ON u.id = n.writer_id
		LEFT JOIN news_item_reads my_read
			ON my_read.news_item_id = n.id
		   AND my_read.user_id = ${viewerParam}
		LEFT JOIN news_item_reactions my_reaction
			ON my_reaction.news_item_id = n.id
		   AND my_reaction.user_id = ${viewerParam}
		   AND my_reaction.reaction_type = '${NEWS_REACTION_TYPE}'
		LEFT JOIN LATERAL (
			SELECT COUNT(*)::int AS like_count
			FROM news_item_reactions reactions
			WHERE reactions.news_item_id = n.id
			  AND reactions.reaction_type = '${NEWS_REACTION_TYPE}'
		) like_counts ON TRUE
		LEFT JOIN LATERAL (
			SELECT COUNT(*)::int AS comment_count
			FROM news_item_comments comments
			WHERE comments.news_item_id = n.id
		) comment_counts ON TRUE
	`;
}

export async function listNewsVisibleToUser(
	trainerId: number,
	opts?: ListNewsOptions
): Promise<NewsRecord[]> {
	const roles = await getTrainerRoles(trainerId);
	const patterns = rolePatterns(roles);
	const isAdmin = canAdministrateNews(roles);
	const limit = Number.isFinite(opts?.limit) ? Math.max(1, Number(opts?.limit)) : 10;
	const offset = Number.isFinite(opts?.offset) ? Math.max(0, Number(opts?.offset)) : 0;
	const filter = parseNewsFilter(opts?.filter);

	const params: any[] = [patterns, trainerId, isAdmin, limit, offset];
	const where = [visibilityClause('$1', '$2', '$3')];

	if (opts?.recentOnly) {
		where.push(`n.created_at > NOW() - INTERVAL '1 month'`);
	}

	if (filter === 'pinned') {
		where.push(`COALESCE(n.pinned, FALSE) = TRUE`);
	}

	if (filter === 'unread') {
		where.push(
			`NOT EXISTS (
				SELECT 1
				FROM news_item_reads unread_reads
				WHERE unread_reads.news_item_id = n.id
				  AND unread_reads.user_id = $2
			)`
		);
	}

	const rows = await query(
		`
		${newsSelectSql('$2')}
		WHERE ${where.join(' AND ')}
		ORDER BY COALESCE(n.pinned, FALSE) DESC, n.created_at DESC, n.id DESC
		LIMIT $4 OFFSET $5
	`,
		params
	);

	return rows.map(toNewsRecord);
}

export async function getNewsVisibleToUser(
	trainerId: number,
	newsId: number
): Promise<NewsRecord | null> {
	const roles = await getTrainerRoles(trainerId);
	const patterns = rolePatterns(roles);
	const isAdmin = canAdministrateNews(roles);
	const [row] = await query(
		`
		${newsSelectSql('$3')}
		WHERE n.id = $1
		  AND ${visibilityClause('$2', '$3', '$4')}
		LIMIT 1
	`,
		[newsId, patterns, trainerId, isAdmin]
	);
	return row ? toNewsRecord(row) : null;
}

export async function insertNews({
	title,
	text,
	writerId,
	roles,
	pinned = false
}: {
	title: string;
	text: string;
	writerId: number;
	roles: string[];
	pinned?: boolean;
}): Promise<NewsRecord> {
	const rolesText = serializeRoles(sanitizeRoles(roles));
	const [row] = await query(
		`
		INSERT INTO news_items (title, text, writer_id, published_at, roles, pinned, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), $4, $5, NOW(), NOW())
		RETURNING id
	`,
		[title, text, writerId, rolesText, Boolean(pinned)]
	);

	const created = await getNewsVisibleToUser(writerId, row.id);
	if (!created) throw new Error('Kunde inte hämta den skapade nyheten');
	return created;
}

export async function updateNews({
	id,
	title,
	text,
	roles,
	pinned = false,
	viewerId
}: {
	id: number;
	title: string;
	text: string;
	roles: string[];
	pinned?: boolean;
	viewerId: number;
}): Promise<NewsRecord | null> {
	const rolesText = serializeRoles(sanitizeRoles(roles));
	const rows = await query(
		`
		UPDATE news_items
		SET title = $1,
			text = $2,
			roles = $3,
			pinned = $4,
			updated_at = NOW()
		WHERE id = $5
		RETURNING id
	`,
		[title, text, rolesText, Boolean(pinned), id]
	);
	const updated = rows[0];
	if (!updated) return null;

	return getNewsVisibleToUser(viewerId, id);
}

export async function deleteNews(id: number) {
	await query(`DELETE FROM news_items WHERE id = $1`, [id]);
}

export async function markNewsRead(newsId: number, trainerId: number): Promise<string | null> {
	const [row] = await query(
		`
		WITH inserted AS (
		INSERT INTO news_item_reads (news_item_id, user_id, read_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (news_item_id, user_id)
			DO NOTHING
		RETURNING read_at
		)
		SELECT read_at
		FROM inserted
		UNION ALL
		SELECT read_at
		FROM news_item_reads
		WHERE news_item_id = $1
		  AND user_id = $2
		  AND NOT EXISTS (SELECT 1 FROM inserted)
		LIMIT 1
	`,
		[newsId, trainerId]
	);

	return row?.read_at ?? null;
}

export async function setNewsLikeReaction({
	newsId,
	trainerId,
	active
}: {
	newsId: number;
	trainerId: number;
	active: boolean;
}): Promise<NewsRecord | null> {
	if (active) {
		await query(
			`
			INSERT INTO news_item_reactions (news_item_id, user_id, reaction_type, created_at)
			VALUES ($1, $2, $3, NOW())
			ON CONFLICT (news_item_id, user_id, reaction_type) DO NOTHING
		`,
			[newsId, trainerId, NEWS_REACTION_TYPE]
		);
	} else {
		await query(
			`
			DELETE FROM news_item_reactions
			WHERE news_item_id = $1
			  AND user_id = $2
			  AND reaction_type = $3
		`,
			[newsId, trainerId, NEWS_REACTION_TYPE]
		);
	}

	return getNewsVisibleToUser(trainerId, newsId);
}

export async function findRecipientsByRoles(
	roles: string[]
): Promise<{ id: number; email: string | null; name: string | null }[]> {
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
	return String(html ?? '')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();
}

export function newsSnippet(html: string, maxLength = 180): string {
	const plain = stripHtmlToText(html);
	if (plain.length <= maxLength) return plain;
	return `${plain.slice(0, maxLength - 1).trimEnd()}…`;
}

function toNewsRecord(row: any): NewsRecord {
	return {
		id: Number(row.id),
		title: row.title ?? '',
		text: row.text ?? '',
		snippet: newsSnippet(row.text ?? ''),
		writer_id: row.writer_id ?? null,
		writer_name: row.writer_name?.trim() || null,
		published_at: row.published_at ?? null,
		roles: parseRolesText(row.roles),
		pinned: row.pinned === true || row.pinned === 't',
		read_at: row.read_at ?? null,
		like_count: Number(row.like_count ?? 0),
		has_reacted: row.has_reacted === true || row.has_reacted === 't',
		comment_count: Number(row.comment_count ?? 0),
		created_at: row.created_at,
		updated_at: row.updated_at
	};
}

export function sanitizeNewsRoles(input: unknown): string[] {
	return sanitizeRoles(input);
}

export function sanitizeNewsCommentBody(input: unknown): {
	body: string;
	error: string | null;
} {
	if (typeof input !== 'string') {
		return { body: '', error: 'Kommentar krävs' };
	}

	const body = input.trim();
	if (!body) {
		return { body: '', error: 'Kommentar krävs' };
	}

	if (body.length > NEWS_COMMENT_MAX_LENGTH) {
		return {
			body,
			error: `Kommentaren får vara max ${NEWS_COMMENT_MAX_LENGTH} tecken`
		};
	}

	return { body, error: null };
}

function toNewsCommentRecord(
	row: any,
	viewerId: number,
	viewerIsAdmin: boolean
): NewsCommentRecord {
	const userId = Number(row.user_id);
	const canEdit = userId === viewerId;
	return {
		id: Number(row.id),
		news_item_id: Number(row.news_item_id),
		user_id: userId,
		user_name: row.user_name?.trim() || null,
		body: row.body ?? '',
		created_at: row.created_at,
		updated_at: row.updated_at,
		can_edit: canEdit,
		can_delete: canEdit || viewerIsAdmin
	};
}

async function getViewerIsAdmin(viewerId: number) {
	const roles = await getTrainerRoles(viewerId);
	return canAdministrateNews(roles);
}

export async function listNewsComments(
	newsId: number,
	viewerId: number
): Promise<NewsCommentRecord[]> {
	const viewerIsAdmin = await getViewerIsAdmin(viewerId);
	const rows = await query(
		`
		SELECT
			c.*,
			COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '') AS user_name
		FROM news_item_comments c
		LEFT JOIN users u ON u.id = c.user_id
		WHERE c.news_item_id = $1
		ORDER BY c.created_at ASC, c.id ASC
	`,
		[newsId]
	);

	return rows.map((row) => toNewsCommentRecord(row, viewerId, viewerIsAdmin));
}

export async function getNewsComment(
	newsId: number,
	commentId: number,
	viewerId: number
): Promise<NewsCommentRecord | null> {
	const viewerIsAdmin = await getViewerIsAdmin(viewerId);
	const [row] = await query(
		`
		SELECT
			c.*,
			COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '') AS user_name
		FROM news_item_comments c
		LEFT JOIN users u ON u.id = c.user_id
		WHERE c.news_item_id = $1
		  AND c.id = $2
		LIMIT 1
	`,
		[newsId, commentId]
	);

	return row ? toNewsCommentRecord(row, viewerId, viewerIsAdmin) : null;
}

export async function insertNewsComment({
	newsId,
	trainerId,
	body
}: {
	newsId: number;
	trainerId: number;
	body: string;
}): Promise<NewsCommentRecord> {
	const [created] = await query(
		`
		INSERT INTO news_item_comments (news_item_id, user_id, body, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		RETURNING id
	`,
		[newsId, trainerId, body]
	);

	const comment = await getNewsComment(newsId, created.id, trainerId);
	if (!comment) throw new Error('Kunde inte hämta kommentaren');
	return comment;
}

export async function updateNewsComment({
	newsId,
	commentId,
	body,
	viewerId
}: {
	newsId: number;
	commentId: number;
	body: string;
	viewerId: number;
}): Promise<NewsCommentRecord | null> {
	const rows = await query(
		`
		UPDATE news_item_comments
		SET body = $1,
			updated_at = NOW()
		WHERE news_item_id = $2
		  AND id = $3
		RETURNING id
	`,
		[body, newsId, commentId]
	);

	if (!rows[0]) return null;
	return getNewsComment(newsId, commentId, viewerId);
}

export async function deleteNewsComment(newsId: number, commentId: number) {
	await query(
		`
		DELETE FROM news_item_comments
		WHERE news_item_id = $1
		  AND id = $2
	`,
		[newsId, commentId]
	);
}
