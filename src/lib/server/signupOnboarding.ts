import * as db from '$lib/db';
import {
	mergeClientProfiles,
	mergeCustomerProfiles,
	ProfileLifecycleError
} from '$lib/server/profileLifecycle';
import { chargeablePackageBookingSql } from '$lib/server/packageSemantics';
import type {
	SignupOnboardingAction,
	SignupOnboardingStatus,
	SignupOnboardingSummary
} from '$lib/types/signupOnboarding';
import type { PoolClient } from 'pg';

type SqlClient = Pick<PoolClient, 'query'>;

export class SignupOnboardingError extends Error {
	constructor(
		public status: number,
		message: string,
		public code: string
	) {
		super(message);
	}
}

const pool = (db as any).pool as { connect: () => Promise<PoolClient> };

async function txQuery<T = any>(client: SqlClient, text: string, params: unknown[] = []) {
	return (await (db as any).queryWithClient(client as PoolClient, text, params)) as T[];
}

function positiveInt(value: unknown) {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function text(value: unknown) {
	return typeof value === 'string' ? value.trim() : '';
}

function normalizeDigits(value: unknown) {
	return text(value).replace(/\D/g, '');
}

function normalizeOnboardingDetails(value: unknown) {
	const details = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
	return {
		firstname: text(details.firstname),
		lastname: text(details.lastname),
		email: text(details.email).toLowerCase(),
		person_number: text(details.person_number),
		phone: text(details.phone),
		streetAddress: text(details.streetAddress),
		zip: text(details.zip),
		city: text(details.city)
	};
}

function validateOnboardingDetails(details: ReturnType<typeof normalizeOnboardingDetails>) {
	if (
		!details.firstname ||
		!details.lastname ||
		!details.phone ||
		!details.streetAddress ||
		!details.city
	) {
		throw new SignupOnboardingError(400, 'Fyll i alla klientuppgifter', 'invalid_details');
	}
	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(details.email)) {
		throw new SignupOnboardingError(400, 'Ange en giltig e-postadress', 'invalid_email');
	}
	if (!/^\d{6}-\d{4}$/.test(details.person_number)) {
		throw new SignupOnboardingError(
			400,
			'Ange personnummer som ÅÅMMDD-XXXX',
			'invalid_person_number'
		);
	}
	if (!/^\d{3} ?\d{2}$/.test(details.zip)) {
		throw new SignupOnboardingError(400, 'Ange ett giltigt postnummer', 'invalid_zip');
	}
}

function adminUserId(authUser: any) {
	return positiveInt(authUser?.trainerId ?? authUser?.trainer_id ?? authUser?.id);
}

function isOpen(status: SignupOnboardingStatus) {
	return status === 'new' || status === 'in_progress' || status === 'waiting';
}

function timestampsMatch(current: unknown, expected: unknown) {
	if (!current || typeof expected !== 'string' || !expected) return false;
	const currentTime = new Date(current as string | Date).getTime();
	const expectedTime = new Date(expected).getTime();
	return (
		Number.isFinite(currentTime) && Number.isFinite(expectedTime) && currentTime === expectedTime
	);
}

function mapCaseRow(row: any) {
	return {
		...row,
		id: Number(row.id),
		provisional_client_id: positiveInt(row.provisional_client_id),
		provisional_customer_id: positiveInt(row.provisional_customer_id),
		provisional_package_id: positiveInt(row.provisional_package_id),
		resolved_client_id: positiveInt(row.resolved_client_id),
		resolved_customer_id: positiveInt(row.resolved_customer_id),
		resolved_package_id: positiveInt(row.resolved_package_id),
		resolved_primary_trainer_id: positiveInt(row.resolved_primary_trainer_id),
		resolved_primary_location_id: positiveInt(row.resolved_primary_location_id),
		booking_id: positiveInt(row.booking_id),
		package_client_id: positiveInt(row.package_client_id),
		purchased_package_client_id: positiveInt(row.purchased_package_client_id),
		package_total_sessions:
			row.package_total_sessions === null || row.package_total_sessions === undefined
				? null
				: Number(row.package_total_sessions),
		package_used_sessions: Number(row.package_used_sessions ?? 0),
		purchased_package_total_sessions: Number(row.purchased_package_total_sessions ?? 0),
		purchased_package_used_sessions: Number(row.purchased_package_used_sessions ?? 0),
		submitted_payload: row.submitted_payload ?? {}
	};
}

export async function getSignupOnboardingSummary(_authUser: any): Promise<SignupOnboardingSummary> {
	const rows = (await db.query(
		`
		SELECT COUNT(*)::int AS pending
		FROM signup_onboarding_cases
		WHERE status IN ('new', 'in_progress', 'waiting')
		`
	)) as any[];

	return {
		pending: Number(rows[0]?.pending ?? 0)
	};
}

export async function listSignupOnboardingCases(options: {
	status?: string | null;
	search?: string | null;
	limit?: number;
	offset?: number;
}) {
	const params: unknown[] = [];
	const where: string[] = [];
	const requestedStatuses = text(options.status)
		.split(',')
		.filter((status) =>
			['new', 'in_progress', 'waiting', 'completed', 'cancelled'].includes(status)
		);

	if (requestedStatuses.length) {
		params.push(requestedStatuses);
		where.push(`soc.status = ANY($${params.length}::text[])`);
	} else {
		where.push(`soc.status IN ('new', 'in_progress', 'waiting')`);
	}

	const search = text(options.search);
	if (search) {
		params.push(`%${search}%`);
		const index = params.length;
		where.push(`(
			soc.submitted_payload->>'firstname' ILIKE $${index}
			OR soc.submitted_payload->>'lastname' ILIKE $${index}
			OR soc.submitted_payload->>'email' ILIKE $${index}
			OR soc.submitted_payload->>'phone' ILIKE $${index}
		)`);
	}

	const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 100);
	const offset = Math.max(Number(options.offset) || 0, 0);
	params.push(limit, offset);

	const rows = (await db.query(
		`
		SELECT soc.*,
			EXISTS (
				SELECT 1 FROM clients candidate
				LEFT JOIN gdpr_profile_lifecycle lifecycle
					ON lifecycle.profile_type = 'client' AND lifecycle.client_id = candidate.id
				WHERE candidate.id <> soc.provisional_client_id
					AND lifecycle.gdpr_deleted_at IS NULL
					AND (
						LOWER(candidate.email) = LOWER(soc.submitted_payload->>'email')
						OR regexp_replace(COALESCE(candidate.person_number, ''), '\\D', '', 'g') = regexp_replace(COALESCE(soc.submitted_payload->>'person_number', soc.submitted_payload->>'personnummer', ''), '\\D', '', 'g')
					)
			) AS has_duplicate_warning,
			COUNT(*) OVER()::int AS total_count
		FROM signup_onboarding_cases soc
		WHERE ${where.join(' AND ')}
		ORDER BY
			CASE soc.status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'waiting' THEN 2 ELSE 3 END,
			soc.created_at ASC
		LIMIT $${params.length - 1} OFFSET $${params.length}
		`,
		params
	)) as any[];

	return {
		cases: rows.map(mapCaseRow),
		total: Number(rows[0]?.total_count ?? 0)
	};
}

async function loadClientCandidates(caseRow: any) {
	const payload = caseRow.submitted_payload ?? {};
	const email = text(payload.email).toLowerCase();
	const personNumber = normalizeDigits(payload.person_number ?? payload.personnummer);
	const phone = normalizeDigits(payload.phone);
	const firstname = text(payload.firstname).toLowerCase();
	const lastname = text(payload.lastname).toLowerCase();

	if (!email && !personNumber && !phone && !firstname && !lastname) return [];

	const rows = (await db.query(
		`
		SELECT c.id, c.firstname, c.lastname, c.email, c.phone, c.person_number,
			(
				CASE WHEN $2 <> '' AND regexp_replace(COALESCE(c.person_number, ''), '\\D', '', 'g') = $2 THEN 120 ELSE 0 END +
				CASE WHEN $1 <> '' AND LOWER(COALESCE(c.email, '')) = $1 THEN 100 ELSE 0 END +
				CASE WHEN $3 <> '' AND regexp_replace(COALESCE(c.phone, ''), '\\D', '', 'g') = $3 THEN 70 ELSE 0 END +
				CASE WHEN $4 <> '' AND $5 <> '' AND LOWER(COALESCE(c.firstname, '')) = $4 AND LOWER(COALESCE(c.lastname, '')) = $5 THEN 40 ELSE 0 END +
				CASE WHEN $4 <> '' AND LOWER(COALESCE(c.firstname, '')) = $4 THEN 10 ELSE 0 END +
				CASE WHEN $5 <> '' AND LOWER(COALESCE(c.lastname, '')) = $5 THEN 10 ELSE 0 END
			)::int AS match_score
		FROM clients c
		LEFT JOIN gdpr_profile_lifecycle lifecycle
			ON lifecycle.profile_type = 'client' AND lifecycle.client_id = c.id
		WHERE c.id <> $6
			AND lifecycle.gdpr_deleted_at IS NULL
			AND (
				($2 <> '' AND regexp_replace(COALESCE(c.person_number, ''), '\\D', '', 'g') = $2)
				OR ($1 <> '' AND LOWER(COALESCE(c.email, '')) = $1)
				OR ($3 <> '' AND regexp_replace(COALESCE(c.phone, ''), '\\D', '', 'g') = $3)
				OR ($4 <> '' AND $5 <> '' AND LOWER(COALESCE(c.firstname, '')) = $4 AND LOWER(COALESCE(c.lastname, '')) = $5)
			)
		ORDER BY match_score DESC, c.lastname, c.firstname
		LIMIT 20
		`,
		[email, personNumber, phone, firstname, lastname, caseRow.provisional_client_id]
	)) as any[];

	return rows.map((row) => ({ ...row, id: Number(row.id), match_score: Number(row.match_score) }));
}

async function loadCustomerCandidates(caseRow: any) {
	const payload = caseRow.submitted_payload ?? {};
	const email = text(payload.payerEmail || payload.email).toLowerCase();
	const organizationNumber = normalizeDigits(payload.payerOrganizationNumber);
	const name = text(payload.payerName).toLowerCase();
	if (!email && !organizationNumber && !name) return [];

	const rows = (await db.query(
		`
		SELECT c.id, c.name, c.email, c.phone, c.organization_number,
			(CASE WHEN $2 <> '' AND regexp_replace(COALESCE(c.organization_number, ''), '\\D', '', 'g') = $2 THEN 100 ELSE 0 END +
			 CASE WHEN $1 <> '' AND LOWER(COALESCE(c.email, '')) = $1 THEN 80 ELSE 0 END +
			 CASE WHEN $3 <> '' AND LOWER(COALESCE(c.name, '')) = $3 THEN 40 ELSE 0 END)::int AS match_score
		FROM customers c
		LEFT JOIN gdpr_profile_lifecycle lifecycle
			ON lifecycle.profile_type = 'customer' AND lifecycle.customer_id = c.id
		WHERE c.id <> COALESCE($4, 0)
			AND lifecycle.gdpr_deleted_at IS NULL
			AND (($2 <> '' AND regexp_replace(COALESCE(c.organization_number, ''), '\\D', '', 'g') = $2)
				OR ($1 <> '' AND LOWER(COALESCE(c.email, '')) = $1)
				OR ($3 <> '' AND LOWER(COALESCE(c.name, '')) = $3))
		ORDER BY match_score DESC, c.name
		LIMIT 20
		`,
		[email, organizationNumber, name, caseRow.provisional_customer_id]
	)) as any[];

	return rows.map((row) => ({ ...row, id: Number(row.id), match_score: Number(row.match_score) }));
}

export async function getSignupOnboardingCase(caseId: number) {
	const rows = (await db.query(
		`
			SELECT soc.*,
				pc.firstname AS provisional_client_firstname, pc.lastname AS provisional_client_lastname,
				pc.email AS provisional_client_email, pc.phone AS provisional_client_phone,
				pc.person_number AS provisional_client_person_number,
				rc.firstname AS resolved_client_firstname, rc.lastname AS resolved_client_lastname,
				rc.email AS resolved_client_email, rc.phone AS resolved_client_phone,
				rc.person_number AS resolved_client_person_number,
				rc.primary_trainer_id AS resolved_primary_trainer_id,
				primary_trainer.firstname AS resolved_primary_trainer_firstname,
				primary_trainer.lastname AS resolved_primary_trainer_lastname,
				rc.primary_location_id AS resolved_primary_location_id,
				primary_location.name AS resolved_primary_location_name,
				p_customer.name AS provisional_customer_name,
				p_customer.email AS provisional_customer_email,
				p_customer.phone AS provisional_customer_phone,
				p_customer.customer_no AS provisional_customer_no,
				p_customer.organization_number AS provisional_customer_organization_number,
				p_customer.invoice_address AS provisional_customer_invoice_address,
				p_customer.invoice_zip AS provisional_customer_invoice_zip,
				p_customer.invoice_city AS provisional_customer_invoice_city,
				p_customer.invoice_reference AS provisional_customer_invoice_reference,
				r_customer.name AS resolved_customer_name,
				r_customer.email AS resolved_customer_email,
				r_customer.phone AS resolved_customer_phone,
				r_customer.customer_no AS resolved_customer_no,
				r_customer.organization_number AS resolved_customer_organization_number,
				r_customer.invoice_address AS resolved_customer_invoice_address,
				r_customer.invoice_zip AS resolved_customer_invoice_zip,
				r_customer.invoice_city AS resolved_customer_invoice_city,
				r_customer.invoice_reference AS resolved_customer_invoice_reference,
				a.name AS package_name,
				a.sessions AS package_total_sessions,
				p.paid_price AS package_paid_price,
				p.autogiro AS package_autogiro,
				p.client_id AS package_client_id,
				package_client.firstname AS package_client_firstname,
				package_client.lastname AS package_client_lastname,
				(
					SELECT COUNT(*)::int
					FROM bookings resolved_booking
					WHERE resolved_booking.package_id = p.id
						AND ${chargeablePackageBookingSql('resolved_booking')}
				) AS package_used_sessions,
				purchased_article.name AS purchased_package_name,
				purchased_article.sessions AS purchased_package_total_sessions,
				purchased_package.paid_price AS purchased_package_paid_price,
				purchased_package.autogiro AS purchased_package_autogiro,
				purchased_package.client_id AS purchased_package_client_id,
				purchased_package_client.firstname AS purchased_package_client_firstname,
				purchased_package_client.lastname AS purchased_package_client_lastname,
				(
					SELECT COUNT(*)::int
					FROM bookings purchased_booking
					WHERE purchased_booking.package_id = purchased_package.id
					AND ${chargeablePackageBookingSql('purchased_booking')}
			) AS purchased_package_used_sessions
		FROM signup_onboarding_cases soc
		LEFT JOIN clients pc ON pc.id = soc.provisional_client_id
		LEFT JOIN clients rc ON rc.id = soc.resolved_client_id
		LEFT JOIN users primary_trainer ON primary_trainer.id = rc.primary_trainer_id
		LEFT JOIN locations primary_location ON primary_location.id = rc.primary_location_id
		LEFT JOIN customers p_customer ON p_customer.id = soc.provisional_customer_id
			LEFT JOIN customers r_customer ON r_customer.id = soc.resolved_customer_id
			LEFT JOIN packages p ON p.id = soc.resolved_package_id
			LEFT JOIN articles a ON a.id = p.article_id
			LEFT JOIN clients package_client ON package_client.id = p.client_id
			LEFT JOIN packages purchased_package ON purchased_package.id = soc.provisional_package_id
			LEFT JOIN articles purchased_article ON purchased_article.id = purchased_package.article_id
			LEFT JOIN clients purchased_package_client ON purchased_package_client.id = purchased_package.client_id
			WHERE soc.id = $1
			`,
		[caseId]
	)) as any[];
	if (!rows[0]) throw new SignupOnboardingError(404, 'Registreringen hittades inte', 'not_found');

	const caseRow = mapCaseRow(rows[0]);
	const [clientCandidates, customerCandidates] = await Promise.all([
		loadClientCandidates(caseRow),
		loadCustomerCandidates(caseRow)
	]);

	return {
		case: caseRow,
		clientCandidates,
		customerCandidates
	};
}

async function audit(
	client: SqlClient,
	caseId: number,
	actorId: number | null,
	action: string,
	metadata: unknown = {}
) {
	await txQuery(
		client,
		`INSERT INTO signup_onboarding_actions (case_id, actor_user_id, action_type, metadata) VALUES ($1, $2, $3, $4::jsonb)`,
		[caseId, actorId, action, JSON.stringify(metadata ?? {})]
	);
}

async function ensureRelationship(client: SqlClient, customerId: number, clientId: number) {
	const existing = await txQuery<any>(
		client,
		`SELECT id FROM client_customer_relationships WHERE customer_id = $1 AND client_id = $2 LIMIT 1`,
		[customerId, clientId]
	);
	if (existing[0]) {
		await txQuery(
			client,
			`UPDATE client_customer_relationships SET active = true, relationship = COALESCE(relationship, 'Training'), updated_at = NOW() WHERE id = $1`,
			[existing[0].id]
		);
		return;
	}
	await txQuery(
		client,
		`INSERT INTO client_customer_relationships (customer_id, client_id, relationship, active, created_at, updated_at) VALUES ($1, $2, 'Training', true, NOW(), NOW())`,
		[customerId, clientId]
	);
}

async function findActiveCustomerIdsForClient(client: SqlClient, clientId: number) {
	const rows = await txQuery<{ customer_id: number }>(
		client,
		`
		SELECT DISTINCT rel.customer_id
		FROM client_customer_relationships rel
		JOIN customers c ON c.id = rel.customer_id
		LEFT JOIN gdpr_profile_lifecycle lifecycle
			ON lifecycle.profile_type = 'customer'
			AND lifecycle.customer_id = c.id
		WHERE rel.client_id = $1
			AND rel.active = true
			AND c.active = true
			AND lifecycle.gdpr_deleted_at IS NULL
		ORDER BY rel.customer_id ASC
		`,
		[clientId]
	);
	return rows.map((row) => positiveInt(row.customer_id)).filter((id): id is number => Boolean(id));
}

async function findUsablePackageIdsForClientCustomer(
	client: SqlClient,
	clientId: number,
	customerId: number
) {
	const rows = await txQuery<{ id: number }>(
		client,
		`
		SELECT p.id
		FROM packages p
		LEFT JOIN articles a ON a.id = p.article_id
		LEFT JOIN LATERAL (
			SELECT COUNT(*)::int AS used_sessions
			FROM bookings b
			WHERE b.package_id = p.id
				AND ${chargeablePackageBookingSql('b')}
		) usage ON TRUE
		WHERE p.customer_id = $1
			AND (p.client_id IS NULL OR p.client_id = $2)
			AND (COALESCE(a.sessions, 0) - COALESCE(usage.used_sessions, 0)) > 0
		ORDER BY
			CASE WHEN p.client_id = $2 THEN 0 ELSE 1 END,
			p.updated_at DESC NULLS LAST,
			p.id DESC
		`,
		[customerId, clientId]
	);
	return rows.map((row) => positiveInt(row.id)).filter((id): id is number => Boolean(id));
}

async function loadPackageForResolution(client: SqlClient, packageId: number) {
	const rows = await txQuery<any>(
		client,
		`
		SELECT
			p.id,
			p.customer_id,
			p.client_id,
			a.sessions AS total_sessions,
			COALESCE(usage.used_sessions, 0)::int AS used_sessions,
			(COALESCE(a.sessions, 0) - COALESCE(usage.used_sessions, 0))::int AS remaining_sessions
		FROM packages p
		LEFT JOIN articles a ON a.id = p.article_id
		LEFT JOIN LATERAL (
			SELECT COUNT(*)::int AS used_sessions
			FROM bookings b
			WHERE b.package_id = p.id
				AND ${chargeablePackageBookingSql('b')}
		) usage ON TRUE
		WHERE p.id = $1
		FOR UPDATE OF p
		`,
		[packageId]
	);
	return rows[0] ?? null;
}

function packageHasRemainingSessions(packageRow: any) {
	const remaining = Number(packageRow?.remaining_sessions ?? NaN);
	return Number.isFinite(remaining) && remaining > 0;
}

async function assertActiveTrainer(client: SqlClient, userId: number) {
	const rows = await txQuery(client, `SELECT id FROM users WHERE id = $1 AND active = true`, [
		userId
	]);
	if (!rows[0]) {
		throw new SignupOnboardingError(404, 'Tränaren hittades inte', 'trainer_not_found');
	}
}

async function assertLocation(client: SqlClient, locationId: number) {
	const rows = await txQuery(client, `SELECT id FROM locations WHERE id = $1`, [locationId]);
	if (!rows[0]) {
		throw new SignupOnboardingError(404, 'Lokalen hittades inte', 'location_not_found');
	}
}

async function autoResolveAfterClientMerge(
	client: SqlClient,
	caseRow: any,
	targetClientId: number
) {
	let resolvedCustomerId = positiveInt(caseRow.resolved_customer_id);
	let customerResolution: 'kept' | 'connected' | null = null;
	let resolvedPackageId = positiveInt(caseRow.resolved_package_id);
	let packageResolution: 'kept' | 'connected' | null = null;
	const metadata: Record<string, unknown> = {};

	if (caseRow.customer_resolution === 'pending') {
		const provisionalCustomerId = positiveInt(caseRow.provisional_customer_id);
		if (provisionalCustomerId) {
			await ensureRelationship(client, provisionalCustomerId, targetClientId);
			resolvedCustomerId = provisionalCustomerId;
			customerResolution = 'kept';
			metadata.customer = { resolution: customerResolution, customerId: provisionalCustomerId };
		} else {
			const customerIds = await findActiveCustomerIdsForClient(client, targetClientId);
			if (customerIds.length === 1) {
				resolvedCustomerId = customerIds[0];
				customerResolution = 'connected';
				metadata.customer = { resolution: customerResolution, customerId: resolvedCustomerId };
			} else {
				metadata.customer = { resolution: 'manual_required', candidateCount: customerIds.length };
			}
		}
	}

	if (caseRow.package_resolution === 'pending') {
		const provisionalPackageId = positiveInt(caseRow.provisional_package_id);
		if (provisionalPackageId) {
			const packageRow = await loadPackageForResolution(client, provisionalPackageId);
			const packageCustomerId = positiveInt(packageRow?.customer_id);
			const packageClientId = positiveInt(packageRow?.client_id);
			if (
				packageRow &&
				packageHasRemainingSessions(packageRow) &&
				(!resolvedCustomerId || packageCustomerId === resolvedCustomerId) &&
				(!packageClientId ||
					packageClientId === targetClientId ||
					packageClientId === positiveInt(caseRow.provisional_client_id))
			) {
				if (packageClientId !== targetClientId) {
					await txQuery(
						client,
						`UPDATE packages SET client_id = $2, updated_at = NOW() WHERE id = $1`,
						[provisionalPackageId, targetClientId]
					);
				}
				resolvedPackageId = provisionalPackageId;
				packageResolution = 'kept';
				metadata.package = { resolution: packageResolution, packageId: provisionalPackageId };
			} else {
				metadata.package = { resolution: 'manual_required', packageId: provisionalPackageId };
			}
		} else if (resolvedCustomerId) {
			const packageIds = await findUsablePackageIdsForClientCustomer(
				client,
				targetClientId,
				resolvedCustomerId
			);
			if (packageIds.length === 1) {
				resolvedPackageId = packageIds[0];
				packageResolution = 'connected';
				metadata.package = { resolution: packageResolution, packageId: resolvedPackageId };
			} else {
				metadata.package = { resolution: 'manual_required', candidateCount: packageIds.length };
			}
		}
	}

	return {
		resolvedCustomerId,
		customerResolution,
		resolvedPackageId,
		packageResolution,
		metadata
	};
}

function completionError(caseRow: any) {
	if (caseRow.client_resolution === 'pending' || !caseRow.resolved_client_id) {
		return 'Bekräfta eller slå ihop klienten först';
	}
	if (caseRow.customer_resolution === 'pending') return 'Lös kundkopplingen först';
	if (caseRow.package_resolution === 'pending') return 'Lös paketkopplingen först';
	if (caseRow.primary_assignment_resolution === 'pending') {
		return 'Välj eller hoppa över primär tränare och lokal först';
	}
	if (!caseRow.resolved_customer_id) return 'En giltig kundkoppling krävs';
	if (caseRow.package_resolution !== 'not_required' && !caseRow.resolved_package_id) {
		return 'Ett giltigt paket krävs';
	}
	return null;
}

function assertClientResolved(caseRow: any) {
	const resolvedClientId = positiveInt(caseRow.resolved_client_id);
	if (caseRow.client_resolution === 'pending' || !resolvedClientId) {
		throw new SignupOnboardingError(
			409,
			'Bekräfta eller slå ihop klienten först',
			'client_resolution_required'
		);
	}
	return resolvedClientId;
}

function assertCustomerResolved(caseRow: any) {
	const resolvedCustomerId = positiveInt(caseRow.resolved_customer_id);
	if (caseRow.customer_resolution === 'pending' || !resolvedCustomerId) {
		throw new SignupOnboardingError(
			409,
			'Lös kundkopplingen först',
			'customer_resolution_required'
		);
	}
	return resolvedCustomerId;
}

async function markCaseInProgress(client: SqlClient, caseId: number) {
	await txQuery(
		client,
		`UPDATE signup_onboarding_cases SET status = 'in_progress', updated_at = NOW() WHERE id = $1 AND status = 'new'`,
		[caseId]
	);
}

async function completeCaseIfReady(client: SqlClient, caseId: number) {
	const rows = await txQuery<any>(client, `SELECT * FROM signup_onboarding_cases WHERE id = $1`, [
		caseId
	]);
	const caseRow = rows[0];
	if (!caseRow || !isOpen(caseRow.status) || completionError(caseRow)) return false;

	await txQuery(
		client,
		`
		UPDATE signup_onboarding_cases
		SET status = 'completed',
			waiting_note = NULL,
			completion_note = NULL,
			completed_at = COALESCE(completed_at, NOW()),
			updated_at = NOW()
		WHERE id = $1
		`,
		[caseId]
	);
	return true;
}

export async function performSignupOnboardingAction(options: {
	caseId: number;
	action: SignupOnboardingAction;
	authUser: any;
}) {
	const client = await pool.connect();
	const actorId = adminUserId(options.authUser);
	let started = false;

	try {
		await client.query('BEGIN');
		started = true;
		const rows = await txQuery<any>(
			client,
			`SELECT * FROM signup_onboarding_cases WHERE id = $1 FOR UPDATE`,
			[options.caseId]
		);
		const caseRow = rows[0];
		if (!caseRow) throw new SignupOnboardingError(404, 'Registreringen hittades inte', 'not_found');

		const action = options.action;
		if (!action || typeof action.type !== 'string') {
			throw new SignupOnboardingError(400, 'Ogiltig åtgärd', 'invalid_action');
		}
		if (!timestampsMatch(caseRow.updated_at, action.expectedUpdatedAt)) {
			throw new SignupOnboardingError(
				409,
				'Någon annan har redan uppdaterat registreringen. Den senaste versionen har hämtats.',
				'case_changed'
			);
		}
		if (!isOpen(caseRow.status) && !['reopen'].includes(action.type)) {
			throw new SignupOnboardingError(409, 'Registreringen är redan stängd', 'case_closed');
		}

		let metadata: Record<string, unknown> = {};
		switch (action.type) {
			case 'update_details': {
				if (!caseRow.provisional_client_id) {
					throw new SignupOnboardingError(409, 'Den preliminära klienten saknas', 'missing_client');
				}
				if (caseRow.client_resolution === 'merged') {
					throw new SignupOnboardingError(
						409,
						'Klienten är redan sammanslagen. Uppdatera den befintliga klientprofilen i stället.',
						'client_already_merged'
					);
				}

				const details = normalizeOnboardingDetails(action.details);
				validateOnboardingDetails(details);
				const payloadUpdate: Record<string, unknown> = { ...details };

				await txQuery(
					client,
					`UPDATE clients SET firstname = $2, lastname = $3, email = $4, person_number = $5, phone = $6, updated_at = NOW() WHERE id = $1`,
					[
						caseRow.provisional_client_id,
						details.firstname,
						details.lastname,
						details.email,
						details.person_number,
						details.phone
					]
				);

				if (
					caseRow.provisional_customer_id &&
					(caseRow.submitted_payload ?? {}).paymentChoice !== 'company' &&
					caseRow.customer_resolution !== 'merged'
				) {
					Object.assign(payloadUpdate, {
						payerName: `${details.firstname} ${details.lastname}`,
						payerEmail: details.email,
						payerPhone: details.phone,
						payerInvoiceAddress: details.streetAddress,
						payerInvoiceZip: details.zip,
						payerInvoiceCity: details.city
					});
					await txQuery(
						client,
						`UPDATE customers SET name = $2, email = $3, phone = $4, invoice_address = $5, invoice_zip = $6, invoice_city = $7, updated_at = NOW() WHERE id = $1`,
						[
							caseRow.provisional_customer_id,
							`${details.firstname} ${details.lastname}`,
							details.email,
							details.phone,
							details.streetAddress,
							details.zip,
							details.city
						]
					);
				}

				await txQuery(
					client,
					`UPDATE signup_onboarding_cases SET submitted_payload = submitted_payload || $2::jsonb, status = CASE WHEN status = 'new' THEN 'in_progress' ELSE status END, updated_at = NOW() WHERE id = $1`,
					[options.caseId, JSON.stringify(payloadUpdate)]
				);
				metadata = { fields: Object.keys(details) };
				break;
			}
			case 'confirm_new_client':
				if (!caseRow.provisional_client_id)
					throw new SignupOnboardingError(409, 'Den preliminära klienten saknas', 'missing_client');
				await txQuery(
					client,
					`UPDATE signup_onboarding_cases SET resolved_client_id = provisional_client_id, client_resolution = 'confirmed_new', status = CASE WHEN status = 'new' THEN 'in_progress' ELSE status END, updated_at = NOW() WHERE id = $1`,
					[options.caseId]
				);
				break;
			case 'merge_client': {
				const targetClientId = positiveInt(action.targetClientId);
				if (!targetClientId || !caseRow.provisional_client_id)
					throw new SignupOnboardingError(400, 'Välj en målklient', 'invalid_client');
				const result = await mergeClientProfiles({
					client,
					sourceClientId: Number(caseRow.provisional_client_id),
					targetClientId,
					actorUserId: actorId
				});
				const autoResolved = await autoResolveAfterClientMerge(client, caseRow, targetClientId);
				await txQuery(
					client,
					`
					UPDATE signup_onboarding_cases
					SET resolved_client_id = $2,
						client_resolution = 'merged',
						resolved_customer_id = COALESCE($3, resolved_customer_id),
						customer_resolution = CASE
							WHEN $4::text IS NULL THEN customer_resolution
							ELSE $4::text
						END,
						resolved_package_id = COALESCE($5, resolved_package_id),
						package_resolution = CASE
							WHEN $6::text IS NULL THEN package_resolution
							ELSE $6::text
						END,
						status = CASE WHEN status = 'new' THEN 'in_progress' ELSE status END,
						updated_at = NOW()
					WHERE id = $1
					`,
					[
						options.caseId,
						targetClientId,
						autoResolved.customerResolution ? autoResolved.resolvedCustomerId : null,
						autoResolved.customerResolution,
						autoResolved.packageResolution ? autoResolved.resolvedPackageId : null,
						autoResolved.packageResolution
					]
				);
				metadata = { targetClientId, result, autoResolved: autoResolved.metadata };
				break;
			}
			case 'keep_customer':
				assertClientResolved(caseRow);
				if (!caseRow.provisional_customer_id)
					throw new SignupOnboardingError(409, 'Den preliminära kunden saknas', 'missing_customer');
				await txQuery(
					client,
					`UPDATE signup_onboarding_cases SET resolved_customer_id = provisional_customer_id, customer_resolution = 'kept', updated_at = NOW() WHERE id = $1`,
					[options.caseId]
				);
				break;
			case 'merge_customer': {
				assertClientResolved(caseRow);
				const targetCustomerId = positiveInt(action.targetCustomerId);
				if (!targetCustomerId || !caseRow.provisional_customer_id)
					throw new SignupOnboardingError(400, 'Välj en målkund', 'invalid_customer');
				const result = await mergeCustomerProfiles({
					client,
					sourceCustomerId: Number(caseRow.provisional_customer_id),
					targetCustomerId,
					actorUserId: actorId
				});
				await txQuery(
					client,
					`UPDATE signup_onboarding_cases SET resolved_customer_id = $2, customer_resolution = 'merged', updated_at = NOW() WHERE id = $1`,
					[options.caseId, targetCustomerId]
				);
				metadata = { targetCustomerId, result };
				break;
			}
			case 'connect_customer': {
				const resolvedClientId = assertClientResolved(caseRow);
				const targetCustomerId = positiveInt(action.targetCustomerId);
				if (caseRow.provisional_customer_id) {
					throw new SignupOnboardingError(
						409,
						'Slå ihop eller behåll den preliminära kunden',
						'provisional_customer_requires_resolution'
					);
				}
				if (!targetCustomerId || !resolvedClientId)
					throw new SignupOnboardingError(
						400,
						'Bekräfta klient och kund först',
						'invalid_customer'
					);
				const customers = await txQuery(
					client,
					`SELECT id FROM customers WHERE id = $1 AND active = true`,
					[targetCustomerId]
				);
				if (!customers[0])
					throw new SignupOnboardingError(404, 'Kunden hittades inte', 'customer_not_found');
				await ensureRelationship(client, targetCustomerId, resolvedClientId);
				await txQuery(
					client,
					`UPDATE signup_onboarding_cases SET resolved_customer_id = $2, customer_resolution = 'connected', updated_at = NOW() WHERE id = $1`,
					[options.caseId, targetCustomerId]
				);
				metadata = { targetCustomerId };
				break;
			}
			case 'keep_package':
				assertClientResolved(caseRow);
				assertCustomerResolved(caseRow);
				if (!caseRow.provisional_package_id)
					throw new SignupOnboardingError(409, 'Det preliminära paketet saknas', 'missing_package');
				{
					const packageId = Number(caseRow.provisional_package_id);
					const packageRow = await loadPackageForResolution(client, packageId);
					const resolvedClientId = positiveInt(caseRow.resolved_client_id);
					const resolvedCustomerId = positiveInt(caseRow.resolved_customer_id);
					const packageClientId = positiveInt(packageRow?.client_id);
					if (!packageRow) {
						throw new SignupOnboardingError(404, 'Paketet hittades inte', 'package_not_found');
					}
					if (resolvedCustomerId && Number(packageRow.customer_id) !== resolvedCustomerId) {
						throw new SignupOnboardingError(
							400,
							'Paketet tillhör inte den valda kunden',
							'invalid_package'
						);
					}
					if (
						packageClientId &&
						resolvedClientId &&
						packageClientId !== resolvedClientId &&
						packageClientId !== positiveInt(caseRow.provisional_client_id)
					) {
						throw new SignupOnboardingError(
							400,
							'Paketet är personligt för en annan klient',
							'personal_package'
						);
					}
					if (!packageHasRemainingSessions(packageRow)) {
						throw new SignupOnboardingError(
							409,
							'Paketet har inga pass kvar',
							'package_fully_booked'
						);
					}
				}
				await txQuery(
					client,
					`UPDATE signup_onboarding_cases SET resolved_package_id = provisional_package_id, package_resolution = 'kept', updated_at = NOW() WHERE id = $1`,
					[options.caseId]
				);
				break;
			case 'connect_package': {
				const packageId = positiveInt(action.packageId);
				const resolvedClientId = assertClientResolved(caseRow);
				const resolvedCustomerId = assertCustomerResolved(caseRow);
				if (!packageId)
					throw new SignupOnboardingError(400, 'Bekräfta klient och kund först', 'invalid_package');
				const packageRow = await loadPackageForResolution(client, packageId);
				if (!packageRow || Number(packageRow.customer_id) !== resolvedCustomerId)
					throw new SignupOnboardingError(
						400,
						'Paketet tillhör inte den valda kunden',
						'invalid_package'
					);
				if (packageRow.client_id && Number(packageRow.client_id) !== resolvedClientId)
					throw new SignupOnboardingError(
						400,
						'Paketet är personligt för en annan klient',
						'personal_package'
					);
				if (!packageHasRemainingSessions(packageRow)) {
					throw new SignupOnboardingError(
						409,
						'Paketet har inga pass kvar',
						'package_fully_booked'
					);
				}
				await ensureRelationship(client, resolvedCustomerId, resolvedClientId);
				const resolution =
					Number(caseRow.provisional_package_id) === packageId ? 'kept' : 'connected';
				await txQuery(
					client,
					`UPDATE signup_onboarding_cases SET resolved_package_id = $2, package_resolution = $3, updated_at = NOW() WHERE id = $1`,
					[options.caseId, packageId, resolution]
				);
				metadata = {
					packageId,
					previousPackageId: positiveInt(caseRow.resolved_package_id),
					resolution
				};
				break;
			}
			case 'skip_package': {
				const resolvedClientId = assertClientResolved(caseRow);
				const resolvedCustomerId = assertCustomerResolved(caseRow);
				const packageIds = await findUsablePackageIdsForClientCustomer(
					client,
					resolvedClientId,
					resolvedCustomerId
				);
				if (packageIds.length > 0) {
					throw new SignupOnboardingError(
						409,
						'Välj ett tillgängligt paket eller byt kund',
						'package_available'
					);
				}
				await txQuery(
					client,
					`
					UPDATE signup_onboarding_cases
					SET resolved_package_id = NULL,
						package_resolution = 'not_required',
						updated_at = NOW()
					WHERE id = $1
					`,
					[options.caseId]
				);
				metadata = { customerId: resolvedCustomerId, skipped: true };
				break;
			}
			case 'set_primary_assignment': {
				const resolvedClientId = assertClientResolved(caseRow);
				const primaryTrainerId = positiveInt(action.primaryTrainerId);
				const primaryLocationId = positiveInt(action.primaryLocationId);
				if (!primaryTrainerId || !primaryLocationId) {
					throw new SignupOnboardingError(
						400,
						'Välj både primär tränare och primär lokal',
						'invalid_primary_assignment'
					);
				}
				await assertActiveTrainer(client, primaryTrainerId);
				await assertLocation(client, primaryLocationId);
				await txQuery(
					client,
					`
					UPDATE clients
					SET primary_trainer_id = $2,
						primary_location_id = $3,
						updated_at = NOW()
					WHERE id = $1
					`,
					[resolvedClientId, primaryTrainerId, primaryLocationId]
				);
				await txQuery(
					client,
					`
					UPDATE signup_onboarding_cases
					SET primary_assignment_resolution = 'selected',
						updated_at = NOW()
					WHERE id = $1
					`,
					[options.caseId]
				);
				metadata = { primaryTrainerId, primaryLocationId };
				break;
			}
			case 'skip_primary_assignment': {
				assertClientResolved(caseRow);
				await txQuery(
					client,
					`
					UPDATE signup_onboarding_cases
					SET primary_assignment_resolution = 'skipped',
						updated_at = NOW()
					WHERE id = $1
					`,
					[options.caseId]
				);
				metadata = { skipped: true };
				break;
			}
			case 'mark_waiting': {
				const note = text(action.note);
				if (!note)
					throw new SignupOnboardingError(400, 'Ange vad registreringen väntar på', 'missing_note');
				await txQuery(
					client,
					`UPDATE signup_onboarding_cases SET status = 'waiting', waiting_note = $2, updated_at = NOW() WHERE id = $1`,
					[options.caseId, note]
				);
				metadata = { note };
				break;
			}
			case 'reopen':
				await txQuery(
					client,
					`UPDATE signup_onboarding_cases SET status = 'in_progress', waiting_note = NULL, completed_at = NULL, cancelled_at = NULL, completion_note = NULL, updated_at = NOW() WHERE id = $1`,
					[options.caseId]
				);
				break;
			case 'attach_booking': {
				const bookingId = positiveInt(action.bookingId);
				const resolvedClientId = assertClientResolved(caseRow);
				const bookings = bookingId
					? await txQuery<any>(client, `SELECT id FROM bookings WHERE id = $1 AND client_id = $2`, [
							bookingId,
							resolvedClientId
						])
					: [];
				if (!bookings[0])
					throw new SignupOnboardingError(
						400,
						'Bokningen tillhör inte den lösta klienten',
						'invalid_booking'
					);
				await txQuery(
					client,
					`UPDATE signup_onboarding_cases SET booking_id = $2, updated_at = NOW() WHERE id = $1`,
					[options.caseId, bookingId]
				);
				metadata = { bookingId };
				break;
			}
			case 'complete': {
				const refreshed = (
					await txQuery<any>(client, `SELECT * FROM signup_onboarding_cases WHERE id = $1`, [
						options.caseId
					])
				)[0];
				const error = completionError(refreshed);
				if (error) throw new SignupOnboardingError(409, error, 'incomplete_case');
				const note = text(action.note);
				await txQuery(
					client,
					`UPDATE signup_onboarding_cases SET status = 'completed', waiting_note = NULL, completion_note = NULLIF($2, ''), completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
					[options.caseId, note]
				);
				metadata = { note };
				break;
			}
			case 'cancel': {
				const note = text(action.note);
				await txQuery(
					client,
					`UPDATE signup_onboarding_cases SET status = 'cancelled', waiting_note = NULL, completion_note = NULLIF($2, ''), cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`,
					[options.caseId, note]
				);
				metadata = { note };
				break;
			}
			default:
				throw new SignupOnboardingError(400, 'Okänd åtgärd', 'invalid_action');
		}

		if (!['mark_waiting', 'reopen', 'complete', 'cancel'].includes(action.type)) {
			await markCaseInProgress(client, options.caseId);
			const autoCompleted = await completeCaseIfReady(client, options.caseId);
			if (autoCompleted) metadata = { ...metadata, autoCompleted: true };
		}

		await audit(client, options.caseId, actorId, action.type, metadata);
		await client.query('COMMIT');
		started = false;
		return getSignupOnboardingCase(options.caseId);
	} catch (error) {
		if (started) await client.query('ROLLBACK');
		if (error instanceof SignupOnboardingError || error instanceof ProfileLifecycleError)
			throw error;
		throw new SignupOnboardingError(
			500,
			(error as Error)?.message || 'Kunde inte uppdatera registreringen',
			'internal_error'
		);
	} finally {
		client.release();
	}
}
