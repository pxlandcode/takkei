import * as db from '$lib/db';
import { reallocateFuturePackageAssignmentsForClient } from '$lib/server/packageReallocation';
import crypto from 'crypto';
import type { PoolClient } from 'pg';

type SqlClient = Pick<PoolClient, 'query'>;

const pool = (db as any).pool as { connect: () => Promise<PoolClient> };

type CountMap = Record<string, number>;

export type DeleteAction = 'hard_delete' | 'anonymize';

export type DeleteImpact = {
	entity: 'client' | 'customer';
	id: number;
	displayName: string;
	gdprDeletedAt: string | null;
	mergedIntoId: number | null;
	action: DeleteAction;
	canHardDelete: boolean;
	retainedRecordCount: number;
	counts: CountMap;
};

export type LifecycleResult = {
	entity: 'client' | 'customer';
	id: number;
	action: 'hard_deleted' | 'anonymized' | 'merged';
	hardDeleted?: boolean;
	anonymized?: boolean;
	targetId?: number;
	sourceDisposition?: 'hard_deleted' | 'anonymized';
	impact?: DeleteImpact;
	counts?: CountMap;
	reallocation?: any;
};

export class ProfileLifecycleError extends Error {
	status: number;
	code: string;

	constructor(status: number, message: string, code = 'profile_lifecycle_error') {
		super(message);
		this.status = status;
		this.code = code;
	}
}

async function txQuery<T = any>(client: SqlClient, text: string, params: unknown[] = []) {
	return (await (db as any).queryWithClient(client as PoolClient, text, params)) as T[];
}

export async function withProfileLifecycleTransaction<T>(
	callback: (client: SqlClient) => Promise<T>
) {
	const client = await pool.connect();
	let transactionStarted = false;

	try {
		await client.query('BEGIN');
		transactionStarted = true;
		const result = await callback(client);
		await client.query('COMMIT');
		transactionStarted = false;
		return result;
	} catch (error) {
		if (transactionStarted) {
			try {
				await client.query('ROLLBACK');
			} catch (rollbackError) {
				console.error('Failed to rollback profile lifecycle transaction:', rollbackError);
			}
		}
		throw error;
	} finally {
		client.release();
	}
}

function toPositiveInt(value: unknown) {
	const n = Number(value);
	if (!Number.isFinite(n) || n <= 0) return null;
	return Math.trunc(n);
}

export function resolveLifecycleActorId(authUser: any) {
	if (!authUser || authUser.kind !== 'trainer') return null;
	return toPositiveInt(authUser.trainerId ?? authUser.trainer_id ?? authUser.id);
}

function randomDeleteToken() {
	return crypto.randomBytes(6).toString('hex');
}

function trimOrNull(value: unknown) {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : null;
}

function compactPrivacyTokens(values: unknown[]) {
	const seen = new Set<string>();
	for (const value of values) {
		const token = trimOrNull(value);
		if (!token || token.length < 3) continue;
		seen.add(token);
	}
	return [...seen];
}

function clientDisplayName(row: any) {
	const name = [row?.firstname, row?.lastname].filter(Boolean).join(' ').trim();
	return name || `Klient ${row?.id ?? ''}`.trim();
}

function customerDisplayName(row: any) {
	return trimOrNull(row?.name) ?? `Kund ${row?.id ?? ''}`.trim();
}

function displayFieldValue(value: unknown) {
	if (value === null || value === undefined) return null;
	const trimmed = String(value).trim();
	return trimmed.length ? trimmed : null;
}

function buildMergeFieldPlan(
	fields: Array<{ key: string; label: string; sourceValue: unknown; targetValue: unknown }>
) {
	return fields.map((field) => {
		const sourceValue = displayFieldValue(field.sourceValue);
		const targetValue = displayFieldValue(field.targetValue);
		const keptFrom = targetValue ? 'target' : sourceValue ? 'source' : 'empty';
		const keptValue = targetValue ?? sourceValue ?? null;

		return {
			key: field.key,
			label: field.label,
			sourceValue,
			targetValue,
			keptValue,
			keptFrom,
			differs: sourceValue !== targetValue
		};
	});
}

function buildClientMergeFieldPlan(source: any, target: any) {
	return buildMergeFieldPlan([
		{
			key: 'name',
			label: 'Namn',
			sourceValue: clientDisplayName(source),
			targetValue: clientDisplayName(target)
		},
		{ key: 'email', label: 'E-post', sourceValue: source?.email, targetValue: target?.email },
		{
			key: 'alternative_email',
			label: 'Alternativ e-post',
			sourceValue: source?.alternative_email,
			targetValue: target?.alternative_email
		},
		{ key: 'phone', label: 'Telefon', sourceValue: source?.phone, targetValue: target?.phone },
		{
			key: 'person_number',
			label: 'Personnummer',
			sourceValue: source?.person_number,
			targetValue: target?.person_number
		},
		{
			key: 'membership_number',
			label: 'Medlemsnummer',
			sourceValue: source?.membership_number,
			targetValue: target?.membership_number
		}
	]);
}

function buildCustomerMergeFieldPlan(source: any, target: any) {
	return buildMergeFieldPlan([
		{ key: 'name', label: 'Namn', sourceValue: source?.name, targetValue: target?.name },
		{ key: 'email', label: 'E-post', sourceValue: source?.email, targetValue: target?.email },
		{ key: 'phone', label: 'Telefon', sourceValue: source?.phone, targetValue: target?.phone },
		{
			key: 'customer_no',
			label: 'Kundnummer',
			sourceValue: source?.customer_no,
			targetValue: target?.customer_no
		},
		{
			key: 'organization_number',
			label: 'Organisationsnummer',
			sourceValue: source?.organization_number,
			targetValue: target?.organization_number
		},
		{
			key: 'invoice_address',
			label: 'Fakturaadress',
			sourceValue: source?.invoice_address,
			targetValue: target?.invoice_address
		},
		{
			key: 'invoice_zip',
			label: 'Postnummer',
			sourceValue: source?.invoice_zip,
			targetValue: target?.invoice_zip
		},
		{
			key: 'invoice_city',
			label: 'Stad',
			sourceValue: source?.invoice_city,
			targetValue: target?.invoice_city
		},
		{
			key: 'invoice_reference',
			label: 'Referens',
			sourceValue: source?.invoice_reference,
			targetValue: target?.invoice_reference
		}
	]);
}

export function getClientDeleteActionFromCounts(counts: CountMap): DeleteAction {
	return (counts.bookings ?? 0) +
		(counts.packages ?? 0) +
		(counts.memberships ?? 0) +
		(counts.invoiceReminders ?? 0) ===
		0
		? 'hard_delete'
		: 'anonymize';
}

export function getCustomerDeleteActionFromCounts(counts: CountMap): DeleteAction {
	return (counts.packages ?? 0) + (counts.memberships ?? 0) === 0
		? 'hard_delete'
		: 'anonymize';
}

async function tableExists(client: SqlClient, tableName: string) {
	const rows = await txQuery<{ exists: boolean }>(
		client,
		`SELECT to_regclass($1) IS NOT NULL AS exists`,
		[`public.${tableName}`]
	);
	return Boolean(rows[0]?.exists);
}

async function countRequired(client: SqlClient, text: string, params: unknown[]) {
	const rows = await txQuery<{ count: number | string }>(client, text, params);
	return Number(rows[0]?.count ?? 0);
}

async function countOptional(
	client: SqlClient,
	tableName: string,
	text: string,
	params: unknown[]
) {
	if (!(await tableExists(client, tableName))) return 0;
	return countRequired(client, text, params);
}

async function upsertClientLifecycleMetadata({
	client,
	clientId,
	actorUserId,
	token,
	mergedIntoClientId
}: {
	client: SqlClient;
	clientId: number;
	actorUserId: number | null;
	token: string;
	mergedIntoClientId: number | null;
}) {
	await txQuery(
		client,
		`
		INSERT INTO gdpr_profile_lifecycle (
			profile_type,
			client_id,
			gdpr_deleted_at,
			gdpr_deleted_by_user_id,
			gdpr_delete_token,
			merged_into_client_id,
			created_at,
			updated_at
		)
		VALUES ('client', $1, NOW(), $2, $3, $4, NOW(), NOW())
		ON CONFLICT (client_id) WHERE profile_type = 'client'
		DO UPDATE SET
			gdpr_deleted_at = COALESCE(gdpr_profile_lifecycle.gdpr_deleted_at, EXCLUDED.gdpr_deleted_at),
			gdpr_deleted_by_user_id = COALESCE(
				gdpr_profile_lifecycle.gdpr_deleted_by_user_id,
				EXCLUDED.gdpr_deleted_by_user_id
			),
			gdpr_delete_token = COALESCE(
				gdpr_profile_lifecycle.gdpr_delete_token,
				EXCLUDED.gdpr_delete_token
			),
			merged_into_client_id = COALESCE(
				EXCLUDED.merged_into_client_id,
				gdpr_profile_lifecycle.merged_into_client_id
			),
			updated_at = NOW()
		`,
		[clientId, actorUserId, token, mergedIntoClientId]
	);
}

async function upsertCustomerLifecycleMetadata({
	client,
	customerId,
	actorUserId,
	token,
	mergedIntoCustomerId
}: {
	client: SqlClient;
	customerId: number;
	actorUserId: number | null;
	token: string;
	mergedIntoCustomerId: number | null;
}) {
	await txQuery(
		client,
		`
		INSERT INTO gdpr_profile_lifecycle (
			profile_type,
			customer_id,
			gdpr_deleted_at,
			gdpr_deleted_by_user_id,
			gdpr_delete_token,
			merged_into_customer_id,
			created_at,
			updated_at
		)
		VALUES ('customer', $1, NOW(), $2, $3, $4, NOW(), NOW())
		ON CONFLICT (customer_id) WHERE profile_type = 'customer'
		DO UPDATE SET
			gdpr_deleted_at = COALESCE(gdpr_profile_lifecycle.gdpr_deleted_at, EXCLUDED.gdpr_deleted_at),
			gdpr_deleted_by_user_id = COALESCE(
				gdpr_profile_lifecycle.gdpr_deleted_by_user_id,
				EXCLUDED.gdpr_deleted_by_user_id
			),
			gdpr_delete_token = COALESCE(
				gdpr_profile_lifecycle.gdpr_delete_token,
				EXCLUDED.gdpr_delete_token
			),
			merged_into_customer_id = COALESCE(
				EXCLUDED.merged_into_customer_id,
				gdpr_profile_lifecycle.merged_into_customer_id
			),
			updated_at = NOW()
		`,
		[customerId, actorUserId, token, mergedIntoCustomerId]
	);
}

export async function getClientDeleteImpact(client: SqlClient, clientId: number): Promise<DeleteImpact> {
	const rows = await txQuery<any>(
		client,
		`SELECT
			c.id,
			c.firstname,
			c.lastname,
			lifecycle.gdpr_deleted_at,
			lifecycle.merged_into_client_id
		 FROM clients c
		 LEFT JOIN gdpr_profile_lifecycle lifecycle
		   ON lifecycle.profile_type = 'client'
		  AND lifecycle.client_id = c.id
		 WHERE c.id = $1`,
		[clientId]
	);
	const row = rows[0];
	if (!row) {
		throw new ProfileLifecycleError(404, 'Klient hittades inte', 'client_not_found');
	}

	const counts = {
		bookings: await countRequired(client, `SELECT COUNT(*)::int AS count FROM bookings WHERE client_id = $1`, [
			clientId
		]),
		packages: await countRequired(client, `SELECT COUNT(*)::int AS count FROM packages WHERE client_id = $1`, [
			clientId
		]),
		memberships: await countRequired(
			client,
			`SELECT COUNT(*)::int AS count FROM memberships WHERE client_id = $1`,
			[clientId]
		),
		invoiceReminders: await countOptional(
			client,
			'invoice_reminders',
			`SELECT COUNT(*)::int AS count FROM invoice_reminders WHERE client_id = $1`,
			[clientId]
		),
		customerRelationships: await countRequired(
			client,
			`SELECT COUNT(*)::int AS count FROM client_customer_relationships WHERE client_id = $1`,
			[clientId]
		),
		notes: await countOptional(
			client,
			'notes',
			`SELECT COUNT(*)::int AS count FROM notes WHERE target_type = 'Client' AND target_id = $1`,
			[clientId]
		),
		standbyTimes: await countOptional(
			client,
			'standby_times',
			`SELECT COUNT(*)::int AS count FROM standby_times WHERE client_id = $1`,
			[clientId]
		),
		authUsers: await countOptional(
			client,
			'auth_user',
			`SELECT COUNT(*)::int AS count FROM auth_user WHERE kind = 'client' AND client_id = $1`,
			[clientId]
		)
	};

	const action = getClientDeleteActionFromCounts(counts);
	const retainedRecordCount =
		counts.bookings + counts.packages + counts.memberships + counts.invoiceReminders;

	return {
		entity: 'client',
		id: clientId,
		displayName: clientDisplayName(row),
		gdprDeletedAt: row.gdpr_deleted_at ?? null,
		mergedIntoId: row.merged_into_client_id ?? null,
		action,
		canHardDelete: action === 'hard_delete',
		retainedRecordCount,
		counts
	};
}

export async function getCustomerDeleteImpact(
	client: SqlClient,
	customerId: number
): Promise<DeleteImpact> {
	const rows = await txQuery<any>(
		client,
		`SELECT
			c.id,
			c.name,
			lifecycle.gdpr_deleted_at,
			lifecycle.merged_into_customer_id
		 FROM customers c
		 LEFT JOIN gdpr_profile_lifecycle lifecycle
		   ON lifecycle.profile_type = 'customer'
		  AND lifecycle.customer_id = c.id
		 WHERE c.id = $1`,
		[customerId]
	);
	const row = rows[0];
	if (!row) {
		throw new ProfileLifecycleError(404, 'Kund hittades inte', 'customer_not_found');
	}

	const counts = {
		packages: await countRequired(
			client,
			`SELECT COUNT(*)::int AS count FROM packages WHERE customer_id = $1`,
			[customerId]
		),
		memberships: await countRequired(
			client,
			`SELECT COUNT(*)::int AS count FROM memberships WHERE customer_id = $1`,
			[customerId]
		),
		clientRelationships: await countRequired(
			client,
			`SELECT COUNT(*)::int AS count FROM client_customer_relationships WHERE customer_id = $1`,
			[customerId]
		),
		legacyClients: await countRequired(
			client,
			`SELECT COUNT(*)::int AS count FROM clients WHERE customer_id = $1`,
			[customerId]
		),
		notes: await countOptional(
			client,
			'notes',
			`SELECT COUNT(*)::int AS count FROM notes WHERE target_type = 'Customer' AND target_id = $1`,
			[customerId]
		)
	};

	const action = getCustomerDeleteActionFromCounts(counts);
	const retainedRecordCount = counts.packages + counts.memberships;

	return {
		entity: 'customer',
		id: customerId,
		displayName: customerDisplayName(row),
		gdprDeletedAt: row.gdpr_deleted_at ?? null,
		mergedIntoId: row.merged_into_customer_id ?? null,
		action,
		canHardDelete: action === 'hard_delete',
		retainedRecordCount,
		counts
	};
}

function collectClientPrivacyTokens(row: any) {
	return compactPrivacyTokens([row?.email, row?.alternative_email, row?.phone, row?.person_number]);
}

function collectCustomerPrivacyTokens(row: any) {
	return compactPrivacyTokens([row?.email, row?.phone, row?.organization_number, row?.customer_no]);
}

async function scrubPrivacyTokens(client: SqlClient, tokens: string[]) {
	if (!tokens.length) return;

	const hasMailHistory = await tableExists(client, 'mail_history');
	const hasAuditLog = await tableExists(client, 'audit_log');

	for (const token of tokens) {
		if (hasMailHistory) {
			await txQuery(
				client,
				`
				UPDATE mail_history
				SET sender_name = CASE WHEN sender_name IS NULL THEN NULL ELSE replace(sender_name, $1, '[borttagen]') END,
				    sender_email = CASE WHEN sender_email IS NULL THEN NULL ELSE replace(sender_email, $1, '[borttagen]') END,
				    subject = replace(subject, $1, '[borttagen]'),
				    header = CASE WHEN header IS NULL THEN NULL ELSE replace(header, $1, '[borttagen]') END,
				    subheader = CASE WHEN subheader IS NULL THEN NULL ELSE replace(subheader, $1, '[borttagen]') END,
				    body_html = CASE WHEN body_html IS NULL THEN NULL ELSE replace(body_html, $1, '[borttagen]') END,
				    body_text = CASE WHEN body_text IS NULL THEN NULL ELSE replace(body_text, $1, '[borttagen]') END,
				    error = CASE WHEN error IS NULL THEN NULL ELSE replace(error, $1, '[borttagen]') END,
				    recipients = replace(recipients::text, $1, '[borttagen]')::jsonb,
				    sent_from = CASE WHEN sent_from IS NULL THEN NULL ELSE replace(sent_from::text, $1, '[borttagen]')::jsonb END
				WHERE sender_name LIKE '%' || $1 || '%'
				   OR sender_email LIKE '%' || $1 || '%'
				   OR subject LIKE '%' || $1 || '%'
				   OR header LIKE '%' || $1 || '%'
				   OR subheader LIKE '%' || $1 || '%'
				   OR body_html LIKE '%' || $1 || '%'
				   OR body_text LIKE '%' || $1 || '%'
				   OR error LIKE '%' || $1 || '%'
				   OR recipients::text LIKE '%' || $1 || '%'
				   OR sent_from::text LIKE '%' || $1 || '%'
				`,
				[token]
			);
		}

		if (hasAuditLog) {
			await txQuery(
				client,
				`
				UPDATE audit_log
				SET params = replace(params, $1, '[borttagen]'),
				    updated_at = NOW()
				WHERE params LIKE '%' || $1 || '%'
				`,
				[token]
			);
		}
	}
}

async function deleteProfileNotes(client: SqlClient, targetType: 'Client' | 'Customer', targetId: number) {
	if (!(await tableExists(client, 'notes'))) return;

	if (await tableExists(client, 'booking_notes')) {
		await txQuery(
			client,
			`
			DELETE FROM booking_notes
			WHERE note_id IN (
				SELECT id FROM notes WHERE target_type = $1 AND target_id = $2
			)
			`,
			[targetType, targetId]
		);
	}

	await txQuery(client, `DELETE FROM notes WHERE target_type = $1 AND target_id = $2`, [
		targetType,
		targetId
	]);
}

async function deleteClientAuth(client: SqlClient, clientId: number) {
	if (!(await tableExists(client, 'auth_user'))) return;

	const authUsers = await txQuery<{ id: string }>(
		client,
		`SELECT id FROM auth_user WHERE kind = 'client' AND client_id = $1`,
		[clientId]
	);
	const authUserIds = authUsers.map((row) => row.id).filter(Boolean);
	if (!authUserIds.length) return;

	if (await tableExists(client, 'auth_session')) {
		await txQuery(client, `DELETE FROM auth_session WHERE user_id = ANY($1::text[])`, [
			authUserIds
		]);
	}
	if (await tableExists(client, 'auth_key')) {
		await txQuery(client, `DELETE FROM auth_key WHERE user_id = ANY($1::text[])`, [authUserIds]);
	}
	await txQuery(client, `DELETE FROM auth_user WHERE id = ANY($1::text[])`, [authUserIds]);
}

async function cleanupClientSideTables(
	client: SqlClient,
	clientId: number,
	sourceRow: any,
	mode: 'delete' | 'anonymize'
) {
	await scrubPrivacyTokens(client, collectClientPrivacyTokens(sourceRow));
	await deleteClientAuth(client, clientId);
	await deleteProfileNotes(client, 'Client', clientId);

	if (await tableExists(client, 'standby_times')) {
		await txQuery(client, `DELETE FROM standby_times WHERE client_id = $1`, [clientId]);
	}

	if (mode === 'delete') {
		await txQuery(client, `DELETE FROM client_customer_relationships WHERE client_id = $1`, [
			clientId
		]);
	} else {
		await txQuery(
			client,
			`UPDATE client_customer_relationships
			 SET active = FALSE, updated_at = NOW()
			 WHERE client_id = $1`,
			[clientId]
		);
	}
}

async function cleanupCustomerSideTables(
	client: SqlClient,
	customerId: number,
	sourceRow: any,
	mode: 'delete' | 'anonymize'
) {
	await scrubPrivacyTokens(client, collectCustomerPrivacyTokens(sourceRow));
	await deleteProfileNotes(client, 'Customer', customerId);

	await txQuery(client, `UPDATE clients SET customer_id = NULL, updated_at = NOW() WHERE customer_id = $1`, [
		customerId
	]);

	if (mode === 'delete') {
		await txQuery(client, `DELETE FROM client_customer_relationships WHERE customer_id = $1`, [
			customerId
		]);
	} else {
		await txQuery(
			client,
			`UPDATE client_customer_relationships
			 SET active = FALSE, updated_at = NOW()
			 WHERE customer_id = $1`,
			[customerId]
		);
	}
}

async function loadClientForUpdate(client: SqlClient, clientId: number) {
	const rows = await txQuery<any>(
		client,
		`
		SELECT
			c.*,
			lifecycle.gdpr_deleted_at,
			lifecycle.gdpr_delete_token,
			lifecycle.merged_into_client_id
		FROM clients c
		LEFT JOIN gdpr_profile_lifecycle lifecycle
		  ON lifecycle.profile_type = 'client'
		 AND lifecycle.client_id = c.id
		WHERE c.id = $1
		FOR UPDATE OF c
		`,
		[clientId]
	);
	const row = rows[0];
	if (!row) throw new ProfileLifecycleError(404, 'Klient hittades inte', 'client_not_found');
	return row;
}

async function loadCustomerForUpdate(client: SqlClient, customerId: number) {
	const rows = await txQuery<any>(
		client,
		`
		SELECT
			c.*,
			lifecycle.gdpr_deleted_at,
			lifecycle.gdpr_delete_token,
			lifecycle.merged_into_customer_id
		FROM customers c
		LEFT JOIN gdpr_profile_lifecycle lifecycle
		  ON lifecycle.profile_type = 'customer'
		 AND lifecycle.customer_id = c.id
		WHERE c.id = $1
		FOR UPDATE OF c
		`,
		[customerId]
	);
	const row = rows[0];
	if (!row) throw new ProfileLifecycleError(404, 'Kund hittades inte', 'customer_not_found');
	return row;
}

async function anonymizeClientRow(
	client: SqlClient,
	clientId: number,
	actorUserId: number | null,
	sourceRow: any,
	mergedIntoClientId: number | null = null
) {
	const token = trimOrNull(sourceRow?.gdpr_delete_token) ?? randomDeleteToken();
	await cleanupClientSideTables(client, clientId, sourceRow, 'anonymize');

	await txQuery(
		client,
		`
		UPDATE clients
		SET customer_id = NULL,
		    primary_trainer_id = NULL,
		    secondary_trainer_id = NULL,
		    third_trainer_id = NULL,
		    primary_location_id = NULL,
		    email = NULL,
		    alternative_email = NULL,
		    firstname = 'Borttagen klient',
		    lastname = $2,
		    phone = NULL,
		    membership_article_id = NULL,
		    membership_end_time = NULL,
		    active = FALSE,
		    membership_status = 'Deleted',
		    membership_number = NULL,
		    notifications = NULL,
		    person_number = NULL,
		    invoice_comment = NULL,
		    key = $3,
		    updated_at = NOW()
		WHERE id = $1
		`,
		[clientId, token, crypto.randomBytes(32).toString('hex')]
	);

	await upsertClientLifecycleMetadata({
		client,
		clientId,
		actorUserId,
		token,
		mergedIntoClientId
	});

	return token;
}

async function anonymizeCustomerRow(
	client: SqlClient,
	customerId: number,
	actorUserId: number | null,
	sourceRow: any,
	mergedIntoCustomerId: number | null = null
) {
	const token = trimOrNull(sourceRow?.gdpr_delete_token) ?? randomDeleteToken();
	await cleanupCustomerSideTables(client, customerId, sourceRow, 'anonymize');

	await txQuery(
		client,
		`
		UPDATE customers
		SET name = $2,
		    invoice_address = NULL,
		    invoice_zip = NULL,
		    invoice_city = NULL,
		    invoice_reference = NULL,
		    organization_number = NULL,
		    email = NULL,
		    phone = NULL,
		    customer_no = NULL,
		    active = FALSE,
		    updated_at = NOW()
		WHERE id = $1
		`,
		[customerId, `Borttagen kund ${token}`]
	);

	await upsertCustomerLifecycleMetadata({
		client,
		customerId,
		actorUserId,
		token,
		mergedIntoCustomerId
	});

	return token;
}

async function hardDeleteClientRow(
	client: SqlClient,
	clientId: number,
	sourceRow: any
): Promise<LifecycleResult> {
	await cleanupClientSideTables(client, clientId, sourceRow, 'delete');
	await txQuery(client, `DELETE FROM clients WHERE id = $1`, [clientId]);
	return { entity: 'client', id: clientId, action: 'hard_deleted', hardDeleted: true };
}

async function hardDeleteCustomerRow(
	client: SqlClient,
	customerId: number,
	sourceRow: any
): Promise<LifecycleResult> {
	await cleanupCustomerSideTables(client, customerId, sourceRow, 'delete');
	await txQuery(client, `DELETE FROM customers WHERE id = $1`, [customerId]);
	return { entity: 'customer', id: customerId, action: 'hard_deleted', hardDeleted: true };
}

export async function deleteClientProfile({
	client,
	clientId,
	actorUserId
}: {
	client: SqlClient;
	clientId: number;
	actorUserId: number | null;
}): Promise<LifecycleResult> {
	const sourceRow = await loadClientForUpdate(client, clientId);
	const impact = await getClientDeleteImpact(client, clientId);

	if (impact.gdprDeletedAt) {
		return { entity: 'client', id: clientId, action: 'anonymized', anonymized: true, impact };
	}

	if (impact.canHardDelete) {
		return { ...(await hardDeleteClientRow(client, clientId, sourceRow)), impact };
	}

	await anonymizeClientRow(client, clientId, actorUserId, sourceRow);
	return { entity: 'client', id: clientId, action: 'anonymized', anonymized: true, impact };
}

export async function deleteCustomerProfile({
	client,
	customerId,
	actorUserId
}: {
	client: SqlClient;
	customerId: number;
	actorUserId: number | null;
}): Promise<LifecycleResult> {
	const sourceRow = await loadCustomerForUpdate(client, customerId);
	const impact = await getCustomerDeleteImpact(client, customerId);

	if (impact.gdprDeletedAt) {
		return { entity: 'customer', id: customerId, action: 'anonymized', anonymized: true, impact };
	}

	if (impact.canHardDelete) {
		return { ...(await hardDeleteCustomerRow(client, customerId, sourceRow)), impact };
	}

	await anonymizeCustomerRow(client, customerId, actorUserId, sourceRow);
	return { entity: 'customer', id: customerId, action: 'anonymized', anonymized: true, impact };
}

async function mergeClientRelationships(client: SqlClient, sourceClientId: number, targetClientId: number) {
	const sourceRels = await txQuery<any>(
		client,
		`
		SELECT id, customer_id, relationship, active
		FROM client_customer_relationships
		WHERE client_id = $1
		ORDER BY active DESC, id ASC
		`,
		[sourceClientId]
	);

	for (const rel of sourceRels) {
		const customerId = Number(rel.customer_id);
		if (!Number.isFinite(customerId)) {
			await txQuery(client, `DELETE FROM client_customer_relationships WHERE id = $1`, [rel.id]);
			continue;
		}

		const existingRows = await txQuery<any>(
			client,
			`
			SELECT id, relationship, active
			FROM client_customer_relationships
			WHERE client_id = $1 AND customer_id = $2
			ORDER BY active DESC, id ASC
			LIMIT 1
			`,
			[targetClientId, customerId]
		);
		const existing = existingRows[0];

		if (existing) {
			await txQuery(
				client,
				`
				UPDATE client_customer_relationships
				SET relationship = COALESCE(NULLIF(relationship, ''), NULLIF($2, ''), 'Training'),
				    active = COALESCE(active, FALSE) OR COALESCE($3::boolean, FALSE),
				    updated_at = NOW()
				WHERE id = $1
				`,
				[existing.id, rel.relationship ?? null, rel.active ?? false]
			);
			await txQuery(client, `DELETE FROM client_customer_relationships WHERE id = $1`, [rel.id]);
		} else {
			await txQuery(
				client,
				`
				UPDATE client_customer_relationships
				SET client_id = $2,
				    updated_at = NOW()
				WHERE id = $1
				`,
				[rel.id, targetClientId]
			);
		}
	}
}

async function mergeCustomerRelationships(
	client: SqlClient,
	sourceCustomerId: number,
	targetCustomerId: number
) {
	const sourceRels = await txQuery<any>(
		client,
		`
		SELECT id, client_id, relationship, active
		FROM client_customer_relationships
		WHERE customer_id = $1
		ORDER BY active DESC, id ASC
		`,
		[sourceCustomerId]
	);

	for (const rel of sourceRels) {
		const clientId = Number(rel.client_id);
		if (!Number.isFinite(clientId)) {
			await txQuery(client, `DELETE FROM client_customer_relationships WHERE id = $1`, [rel.id]);
			continue;
		}

		const existingRows = await txQuery<any>(
			client,
			`
			SELECT id, relationship, active
			FROM client_customer_relationships
			WHERE customer_id = $1 AND client_id = $2
			ORDER BY active DESC, id ASC
			LIMIT 1
			`,
			[targetCustomerId, clientId]
		);
		const existing = existingRows[0];

		if (existing) {
			await txQuery(
				client,
				`
				UPDATE client_customer_relationships
				SET relationship = COALESCE(NULLIF(relationship, ''), NULLIF($2, ''), 'Training'),
				    active = COALESCE(active, FALSE) OR COALESCE($3::boolean, FALSE),
				    updated_at = NOW()
				WHERE id = $1
				`,
				[existing.id, rel.relationship ?? null, rel.active ?? false]
			);
			await txQuery(client, `DELETE FROM client_customer_relationships WHERE id = $1`, [rel.id]);
		} else {
			await txQuery(
				client,
				`
				UPDATE client_customer_relationships
				SET customer_id = $2,
				    updated_at = NOW()
				WHERE id = $1
				`,
				[rel.id, targetCustomerId]
			);
		}
	}
}

async function finalizeMergedClientSource(
	client: SqlClient,
	sourceClientId: number,
	targetClientId: number,
	actorUserId: number | null,
	sourceRow: any
) {
	const impact = await getClientDeleteImpact(client, sourceClientId);
	if (impact.canHardDelete) {
		await hardDeleteClientRow(client, sourceClientId, sourceRow);
		return 'hard_deleted' as const;
	}

	await anonymizeClientRow(client, sourceClientId, actorUserId, sourceRow, targetClientId);
	return 'anonymized' as const;
}

async function finalizeMergedCustomerSource(
	client: SqlClient,
	sourceCustomerId: number,
	targetCustomerId: number,
	actorUserId: number | null,
	sourceRow: any
) {
	const impact = await getCustomerDeleteImpact(client, sourceCustomerId);
	if (impact.canHardDelete) {
		await hardDeleteCustomerRow(client, sourceCustomerId, sourceRow);
		return 'hard_deleted' as const;
	}

	await anonymizeCustomerRow(client, sourceCustomerId, actorUserId, sourceRow, targetCustomerId);
	return 'anonymized' as const;
}

export async function getClientMergePreview({
	client,
	sourceClientId,
	targetClientId
}: {
	client: SqlClient;
	sourceClientId: number;
	targetClientId: number;
}) {
	if (sourceClientId === targetClientId) {
		throw new ProfileLifecycleError(400, 'Välj en annan målklient', 'same_client');
	}

	const sourceRows = await txQuery<any>(
		client,
		`
		SELECT
			c.id,
			c.firstname,
			c.lastname,
			c.email,
			c.alternative_email,
			c.phone,
			c.person_number,
			c.membership_number,
			lifecycle.gdpr_deleted_at
		FROM clients c
		LEFT JOIN gdpr_profile_lifecycle lifecycle
		  ON lifecycle.profile_type = 'client'
		 AND lifecycle.client_id = c.id
		WHERE c.id = $1
		`,
		[sourceClientId]
	);
	const targetRows = await txQuery<any>(
		client,
		`
		SELECT
			c.id,
			c.firstname,
			c.lastname,
			c.email,
			c.alternative_email,
			c.phone,
			c.person_number,
			c.membership_number,
			lifecycle.gdpr_deleted_at
		FROM clients c
		LEFT JOIN gdpr_profile_lifecycle lifecycle
		  ON lifecycle.profile_type = 'client'
		 AND lifecycle.client_id = c.id
		WHERE c.id = $1
		`,
		[targetClientId]
	);
	const source = sourceRows[0];
	const target = targetRows[0];
	if (!source) throw new ProfileLifecycleError(404, 'Klient hittades inte', 'client_not_found');
	if (!target) throw new ProfileLifecycleError(404, 'Målklient hittades inte', 'target_not_found');
	if (target.gdpr_deleted_at) {
		throw new ProfileLifecycleError(400, 'Målklienten är raderad', 'target_deleted');
	}

	return {
		source: { id: source.id, name: clientDisplayName(source), gdprDeletedAt: source.gdpr_deleted_at },
		target: { id: target.id, name: clientDisplayName(target), gdprDeletedAt: target.gdpr_deleted_at },
		fieldPlan: buildClientMergeFieldPlan(source, target),
		impact: await getClientDeleteImpact(client, sourceClientId)
	};
}

export async function getCustomerMergePreview({
	client,
	sourceCustomerId,
	targetCustomerId
}: {
	client: SqlClient;
	sourceCustomerId: number;
	targetCustomerId: number;
}) {
	if (sourceCustomerId === targetCustomerId) {
		throw new ProfileLifecycleError(400, 'Välj en annan målkund', 'same_customer');
	}

	const sourceRows = await txQuery<any>(
		client,
		`
		SELECT
			c.id,
			c.name,
			c.email,
			c.phone,
			c.customer_no,
			c.organization_number,
			c.invoice_address,
			c.invoice_zip,
			c.invoice_city,
			c.invoice_reference,
			lifecycle.gdpr_deleted_at
		FROM customers c
		LEFT JOIN gdpr_profile_lifecycle lifecycle
		  ON lifecycle.profile_type = 'customer'
		 AND lifecycle.customer_id = c.id
		WHERE c.id = $1
		`,
		[sourceCustomerId]
	);
	const targetRows = await txQuery<any>(
		client,
		`
		SELECT
			c.id,
			c.name,
			c.email,
			c.phone,
			c.customer_no,
			c.organization_number,
			c.invoice_address,
			c.invoice_zip,
			c.invoice_city,
			c.invoice_reference,
			lifecycle.gdpr_deleted_at
		FROM customers c
		LEFT JOIN gdpr_profile_lifecycle lifecycle
		  ON lifecycle.profile_type = 'customer'
		 AND lifecycle.customer_id = c.id
		WHERE c.id = $1
		`,
		[targetCustomerId]
	);
	const source = sourceRows[0];
	const target = targetRows[0];
	if (!source) throw new ProfileLifecycleError(404, 'Kund hittades inte', 'customer_not_found');
	if (!target) throw new ProfileLifecycleError(404, 'Målkund hittades inte', 'target_not_found');
	if (target.gdpr_deleted_at) {
		throw new ProfileLifecycleError(400, 'Målkunden är raderad', 'target_deleted');
	}

	return {
		source: { id: source.id, name: customerDisplayName(source), gdprDeletedAt: source.gdpr_deleted_at },
		target: { id: target.id, name: customerDisplayName(target), gdprDeletedAt: target.gdpr_deleted_at },
		fieldPlan: buildCustomerMergeFieldPlan(source, target),
		impact: await getCustomerDeleteImpact(client, sourceCustomerId)
	};
}

export async function mergeClientProfiles({
	client,
	sourceClientId,
	targetClientId,
	actorUserId
}: {
	client: SqlClient;
	sourceClientId: number;
	targetClientId: number;
	actorUserId: number | null;
}): Promise<LifecycleResult> {
	if (sourceClientId === targetClientId) {
		throw new ProfileLifecycleError(400, 'Välj en annan målklient', 'same_client');
	}

	const sourceRow = await loadClientForUpdate(client, sourceClientId);
	const targetRow = await loadClientForUpdate(client, targetClientId);
	if (sourceRow.gdpr_deleted_at) {
		throw new ProfileLifecycleError(400, 'Källklienten är redan raderad', 'source_deleted');
	}
	if (targetRow.gdpr_deleted_at) {
		throw new ProfileLifecycleError(400, 'Målklienten är raderad', 'target_deleted');
	}

	const counts: CountMap = {};
	const countUpdate = async (key: string, sql: string, params: unknown[]) => {
		const rows = await txQuery(client, sql, params);
		counts[key] = rows.length;
	};

	await txQuery(
		client,
		`
		UPDATE clients AS target
		SET customer_id = COALESCE(target.customer_id, source.customer_id),
		    primary_trainer_id = COALESCE(target.primary_trainer_id, source.primary_trainer_id),
		    secondary_trainer_id = COALESCE(target.secondary_trainer_id, source.secondary_trainer_id),
		    third_trainer_id = COALESCE(target.third_trainer_id, source.third_trainer_id),
		    primary_location_id = COALESCE(target.primary_location_id, source.primary_location_id),
		    email = COALESCE(NULLIF(target.email, ''), NULLIF(source.email, '')),
		    alternative_email = COALESCE(NULLIF(target.alternative_email, ''), NULLIF(source.alternative_email, '')),
		    firstname = COALESCE(NULLIF(target.firstname, ''), NULLIF(source.firstname, ''), target.firstname),
		    lastname = COALESCE(NULLIF(target.lastname, ''), NULLIF(source.lastname, ''), target.lastname),
		    phone = COALESCE(NULLIF(target.phone, ''), NULLIF(source.phone, '')),
		    membership_article_id = COALESCE(target.membership_article_id, source.membership_article_id),
		    membership_end_time = COALESCE(target.membership_end_time, source.membership_end_time),
		    active = COALESCE(target.active, source.active, FALSE),
		    membership_status = COALESCE(NULLIF(target.membership_status, ''), NULLIF(source.membership_status, '')),
		    membership_number = COALESCE(NULLIF(target.membership_number, ''), NULLIF(source.membership_number, '')),
		    person_number = COALESCE(NULLIF(target.person_number, ''), NULLIF(source.person_number, '')),
		    invoice_comment = COALESCE(NULLIF(target.invoice_comment, ''), NULLIF(source.invoice_comment, '')),
		    updated_at = NOW()
		FROM clients AS source
		WHERE target.id = $1 AND source.id = $2
		`,
		[targetClientId, sourceClientId]
	);

	await countUpdate(
		'bookings',
		`UPDATE bookings SET client_id = $1, updated_at = NOW() WHERE client_id = $2 RETURNING id`,
		[targetClientId, sourceClientId]
	);
	await countUpdate(
		'packages',
		`UPDATE packages SET client_id = $1, updated_at = NOW() WHERE client_id = $2 RETURNING id`,
		[targetClientId, sourceClientId]
	);
	await countUpdate(
		'memberships',
		`UPDATE memberships SET client_id = $1, updated_at = NOW() WHERE client_id = $2 RETURNING id`,
		[targetClientId, sourceClientId]
	);
	if (await tableExists(client, 'invoice_reminders')) {
		await countUpdate(
			'invoiceReminders',
			`UPDATE invoice_reminders SET client_id = $1, updated_at = NOW() WHERE client_id = $2 RETURNING id`,
			[targetClientId, sourceClientId]
		);
	}
	if (await tableExists(client, 'standby_times')) {
		await countUpdate(
			'standbyTimes',
			`UPDATE standby_times SET client_id = $1, updated_at = NOW() WHERE client_id = $2 RETURNING id`,
			[targetClientId, sourceClientId]
		);
	}
	if (await tableExists(client, 'notes')) {
		await countUpdate(
			'notes',
			`
			UPDATE notes
			SET target_id = $1, updated_at = NOW()
			WHERE target_type = 'Client' AND target_id = $2
			RETURNING id
			`,
			[targetClientId, sourceClientId]
		);
	}

	await mergeClientRelationships(client, sourceClientId, targetClientId);
	await deleteClientAuth(client, sourceClientId);
	await scrubPrivacyTokens(client, collectClientPrivacyTokens(sourceRow));

	const sourceDisposition = await finalizeMergedClientSource(
		client,
		sourceClientId,
		targetClientId,
		actorUserId,
		sourceRow
	);

	const reallocation = await reallocateFuturePackageAssignmentsForClient({
		client,
		clientId: targetClientId,
		actorUserId
	});

	return {
		entity: 'client',
		id: sourceClientId,
		action: 'merged',
		targetId: targetClientId,
		sourceDisposition,
		counts,
		reallocation
	};
}

export async function mergeCustomerProfiles({
	client,
	sourceCustomerId,
	targetCustomerId,
	actorUserId
}: {
	client: SqlClient;
	sourceCustomerId: number;
	targetCustomerId: number;
	actorUserId: number | null;
}): Promise<LifecycleResult> {
	if (sourceCustomerId === targetCustomerId) {
		throw new ProfileLifecycleError(400, 'Välj en annan målkund', 'same_customer');
	}

	const sourceRow = await loadCustomerForUpdate(client, sourceCustomerId);
	const targetRow = await loadCustomerForUpdate(client, targetCustomerId);
	if (sourceRow.gdpr_deleted_at) {
		throw new ProfileLifecycleError(400, 'Källkunden är redan raderad', 'source_deleted');
	}
	if (targetRow.gdpr_deleted_at) {
		throw new ProfileLifecycleError(400, 'Målkunden är raderad', 'target_deleted');
	}

	const affectedClientRows = await txQuery<{ id: number }>(
		client,
		`
		SELECT DISTINCT id
		FROM (
			SELECT client_id AS id
			FROM client_customer_relationships
			WHERE customer_id = ANY($1::int[]) AND client_id IS NOT NULL
			UNION
			SELECT client_id AS id
			FROM packages
			WHERE customer_id = ANY($1::int[]) AND client_id IS NOT NULL
			UNION
			SELECT client_id AS id
			FROM memberships
			WHERE customer_id = ANY($1::int[]) AND client_id IS NOT NULL
			UNION
			SELECT id
			FROM clients
			WHERE customer_id = ANY($1::int[])
		) affected
		WHERE id IS NOT NULL
		`,
		[[sourceCustomerId, targetCustomerId]]
	);
	const affectedClientIds = affectedClientRows
		.map((row) => toPositiveInt(row.id))
		.filter((id): id is number => id !== null);

	const counts: CountMap = {};
	const countUpdate = async (key: string, sql: string, params: unknown[]) => {
		const rows = await txQuery(client, sql, params);
		counts[key] = rows.length;
	};

	await txQuery(
		client,
		`
		UPDATE customers AS target
		SET name = COALESCE(NULLIF(target.name, ''), NULLIF(source.name, ''), target.name),
		    invoice_address = COALESCE(NULLIF(target.invoice_address, ''), NULLIF(source.invoice_address, '')),
		    invoice_zip = COALESCE(NULLIF(target.invoice_zip, ''), NULLIF(source.invoice_zip, '')),
		    invoice_city = COALESCE(NULLIF(target.invoice_city, ''), NULLIF(source.invoice_city, '')),
		    invoice_reference = COALESCE(NULLIF(target.invoice_reference, ''), NULLIF(source.invoice_reference, '')),
		    organization_number = COALESCE(NULLIF(target.organization_number, ''), NULLIF(source.organization_number, '')),
		    email = COALESCE(NULLIF(target.email, ''), NULLIF(source.email, '')),
		    phone = COALESCE(NULLIF(target.phone, ''), NULLIF(source.phone, '')),
		    customer_no = COALESCE(NULLIF(target.customer_no, ''), NULLIF(source.customer_no, '')),
		    active = COALESCE(target.active, source.active, FALSE),
		    updated_at = NOW()
		FROM customers AS source
		WHERE target.id = $1 AND source.id = $2
		`,
		[targetCustomerId, sourceCustomerId]
	);

	await countUpdate(
		'packages',
		`UPDATE packages SET customer_id = $1, updated_at = NOW() WHERE customer_id = $2 RETURNING id`,
		[targetCustomerId, sourceCustomerId]
	);
	await countUpdate(
		'memberships',
		`UPDATE memberships SET customer_id = $1, updated_at = NOW() WHERE customer_id = $2 RETURNING id`,
		[targetCustomerId, sourceCustomerId]
	);
	await countUpdate(
		'legacyClients',
		`UPDATE clients SET customer_id = $1, updated_at = NOW() WHERE customer_id = $2 RETURNING id`,
		[targetCustomerId, sourceCustomerId]
	);
	if (await tableExists(client, 'notes')) {
		await countUpdate(
			'notes',
			`
			UPDATE notes
			SET target_id = $1, updated_at = NOW()
			WHERE target_type = 'Customer' AND target_id = $2
			RETURNING id
			`,
			[targetCustomerId, sourceCustomerId]
		);
	}

	await mergeCustomerRelationships(client, sourceCustomerId, targetCustomerId);
	await scrubPrivacyTokens(client, collectCustomerPrivacyTokens(sourceRow));

	const sourceDisposition = await finalizeMergedCustomerSource(
		client,
		sourceCustomerId,
		targetCustomerId,
		actorUserId,
		sourceRow
	);

	const reallocationResults = [];
	for (const affectedClientId of affectedClientIds) {
		try {
			reallocationResults.push(
				await reallocateFuturePackageAssignmentsForClient({
					client,
					clientId: affectedClientId,
					actorUserId
				})
			);
		} catch (error) {
			reallocationResults.push({
				clientId: affectedClientId,
				error: (error as Error)?.message ?? 'Kunde inte räkna om paketkopplingar'
			});
		}
	}

	return {
		entity: 'customer',
		id: sourceCustomerId,
		action: 'merged',
		targetId: targetCustomerId,
		sourceDisposition,
		counts,
		reallocation: reallocationResults
	};
}
