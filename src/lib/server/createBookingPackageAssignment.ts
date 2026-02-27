import * as db from '$lib/db';
import {
	chargeablePackageBookingSql,
	isPackageUsableOnDate,
	selectActivePackage,
	trainingRelationshipSql
} from '$lib/server/packageSemantics';
import type { PoolClient } from 'pg';

type SqlClient = Pick<PoolClient, 'query'>;

export type PackageAssignmentStatus =
	| 'kept'
	| 'auto_selected'
	| 'cleared_invalid'
	| 'none_available'
	| 'skipped_non_consuming';

type PackageSelectionCandidate = {
	id: number;
	client_id: number | null;
	customer_id: number | null;
	first_payment_date: string | null;
	frozen_from_date: string | null;
	validity_start_date: string | null;
	validity_end_date: string | null;
	article_sessions: number | null;
	used_sessions: number;
	is_personal: boolean;
	is_shared: boolean;
	personal_match?: boolean;
	shared_match?: boolean;
	remaining_sessions: number | null;
};

export type PackageAssignmentResolution = {
	packageId: number | null;
	addedToPackageDate: Date | string | null;
	status: PackageAssignmentStatus;
};

function toIntOrNull(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const n = Number(value);
	if (!Number.isFinite(n)) return null;
	return Math.trunc(n);
}

function normalizeDateYmd(value: unknown) {
	if (typeof value !== 'string') return null;
	const match = value.match(/\d{4}-\d{2}-\d{2}/);
	return match ? match[0] : null;
}

async function txQuery(client: SqlClient, text: string, params: unknown[] = []) {
	return (await (db as any).queryWithClient(client as PoolClient, text, params)) as any[];
}

function toPackageCandidate(row: any): PackageSelectionCandidate {
	const sessions =
		row.article_sessions === null || row.article_sessions === undefined
			? null
			: Number(row.article_sessions);
	const used = Number(row.used_sessions ?? 0);
	const remaining = sessions === null || Number.isNaN(sessions) ? null : sessions - used;

	return {
		id: Number(row.id),
		client_id: toIntOrNull(row.client_id),
		customer_id: toIntOrNull(row.customer_id),
		first_payment_date: normalizeDateYmd(row.first_payment_date),
		frozen_from_date: normalizeDateYmd(row.frozen_from_date),
		validity_start_date: normalizeDateYmd(row.validity_start_date),
		validity_end_date: normalizeDateYmd(row.validity_end_date),
		article_sessions: sessions,
		used_sessions: Number.isFinite(used) ? used : 0,
		is_personal: Boolean(row.is_personal ?? row.personal_match),
		is_shared: Boolean(row.is_shared ?? row.shared_match ?? row.client_id == null),
		personal_match: row.personal_match === undefined ? undefined : Boolean(row.personal_match),
		shared_match: row.shared_match === undefined ? undefined : Boolean(row.shared_match),
		remaining_sessions: remaining
	};
}

function canClientUsePackage(candidate: PackageSelectionCandidate, clientId: number | null) {
	if (!clientId) return false;
	if (candidate.client_id === clientId) return true;
	if (candidate.client_id !== null) return false;
	return Boolean(candidate.shared_match);
}

function isPackageAssignmentValidOnDate(
	candidate: PackageSelectionCandidate,
	checkYmd: string,
	bookingIsChargeable: boolean
) {
	if (
		!isPackageUsableOnDate(
			{
				frozen_from_date: candidate.frozen_from_date,
				validity_start_date: candidate.validity_start_date,
				validity_end_date: candidate.validity_end_date
			},
			checkYmd
		)
	) {
		return false;
	}

	if (!bookingIsChargeable) return true;

	const sessions = candidate.article_sessions;
	if (sessions === null || !Number.isFinite(sessions) || sessions <= 0) {
		return false;
	}

	return Number(candidate.used_sessions) < sessions;
}

async function fetchPackageCandidateById(
	client: SqlClient,
	packageId: number,
	clientId: number | null,
	lockRow: boolean
) {
	const rows = await txQuery(
		client,
		`
		SELECT
			p.id,
			p.client_id,
			p.customer_id,
			p.first_payment_date,
			p.frozen_from_date,
			a.sessions AS article_sessions,
			a.validity_start_date,
			a.validity_end_date,
			CASE WHEN $2::int IS NOT NULL AND p.client_id = $2::int THEN TRUE ELSE FALSE END AS personal_match,
			CASE
				WHEN $2::int IS NOT NULL AND p.client_id IS NULL AND EXISTS (
					SELECT 1
					FROM client_customer_relationships ccr
					WHERE ccr.client_id = $2::int
						AND ccr.customer_id = p.customer_id
						AND ${trainingRelationshipSql('ccr')}
				)
				THEN TRUE
				ELSE FALSE
			END AS shared_match
		FROM packages p
		LEFT JOIN articles a ON a.id = p.article_id
		WHERE p.id = $1
		${lockRow ? 'FOR UPDATE OF p' : ''}
		`,
		[packageId, clientId]
	);

	if (!rows.length) return null;

	const [usage] = await txQuery(
		client,
		`
		SELECT COUNT(*)::int AS used_sessions
		FROM bookings b
		WHERE b.package_id = $1
			AND ${chargeablePackageBookingSql('b')}
		`,
		[packageId]
	);

	return toPackageCandidate({
		...rows[0],
		used_sessions: usage?.used_sessions ?? 0,
		is_personal: rows[0].personal_match,
		is_shared: rows[0].shared_match
	});
}

async function finalizePackageAssignment(
	client: SqlClient,
	packageId: number,
	clientId: number | null,
	checkYmd: string,
	bookingIsChargeable: boolean
) {
	const candidate = await fetchPackageCandidateById(client, packageId, clientId, bookingIsChargeable);
	if (!candidate) return null;
	if (!canClientUsePackage(candidate, clientId)) return null;
	if (!isPackageAssignmentValidOnDate(candidate, checkYmd, bookingIsChargeable)) return null;
	return candidate;
}

async function listAssignablePackagesForClient(client: SqlClient, clientId: number) {
	const rows = await txQuery(
		client,
		`
		SELECT
			p.id,
			p.client_id,
			p.customer_id,
			p.first_payment_date,
			p.frozen_from_date,
			a.sessions AS article_sessions,
			a.validity_start_date,
			a.validity_end_date,
			(
				SELECT COUNT(*)::int
				FROM bookings b
				WHERE b.package_id = p.id
					AND ${chargeablePackageBookingSql('b')}
			) AS used_sessions,
			(p.client_id = $1::int) AS is_personal,
			(p.client_id IS NULL) AS is_shared
		FROM packages p
		LEFT JOIN articles a ON a.id = p.article_id
		WHERE p.client_id = $1::int
			OR (
				p.client_id IS NULL
				AND EXISTS (
					SELECT 1
					FROM client_customer_relationships ccr
					WHERE ccr.client_id = $1::int
						AND ccr.customer_id = p.customer_id
						AND ${trainingRelationshipSql('ccr')}
				)
			)
		`,
		[clientId]
	);

	return rows.map(toPackageCandidate);
}

export async function resolvePackageAssignmentForCreate({
	client,
	clientId,
	explicitPackageId,
	bookingNeedsPackage,
	bookingIsChargeable,
	checkYmd,
	initialAddedToPackageDate
}: {
	client: SqlClient;
	clientId: number | null;
	explicitPackageId: number | null;
	bookingNeedsPackage: boolean;
	bookingIsChargeable: boolean;
	checkYmd: string;
	initialAddedToPackageDate: Date | string | null;
}): Promise<PackageAssignmentResolution> {
	if (!bookingNeedsPackage) {
		return {
			packageId: null,
			addedToPackageDate: null,
			status: 'skipped_non_consuming'
		};
	}

	if (explicitPackageId) {
		const explicitCandidate = await finalizePackageAssignment(
			client,
			explicitPackageId,
			clientId,
			checkYmd,
			bookingIsChargeable
		);

		if (!explicitCandidate) {
			return {
				packageId: null,
				addedToPackageDate: null,
				status: 'cleared_invalid'
			};
		}

		return {
			packageId: explicitPackageId,
			addedToPackageDate: initialAddedToPackageDate,
			status: 'kept'
		};
	}

	if (!clientId) {
		return {
			packageId: null,
			addedToPackageDate: null,
			status: 'none_available'
		};
	}

	const candidates = await listAssignablePackagesForClient(client, clientId);
	const selected = selectActivePackage(candidates, checkYmd);

	if (!selected) {
		return {
			packageId: null,
			addedToPackageDate: null,
			status: 'none_available'
		};
	}

	const finalized = await finalizePackageAssignment(
		client,
		selected.id,
		clientId,
		checkYmd,
		bookingIsChargeable
	);

	if (!finalized) {
		return {
			packageId: null,
			addedToPackageDate: null,
			status: 'none_available'
		};
	}

	return {
		packageId: finalized.id,
		addedToPackageDate: initialAddedToPackageDate ?? new Date(),
		status: 'auto_selected'
	};
}
