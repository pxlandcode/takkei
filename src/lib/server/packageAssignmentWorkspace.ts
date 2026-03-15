import * as db from '$lib/db';
import {
	bookingConsumesPackage,
	chargeablePackageBookingSql,
	getStockholmYmd,
	isChargeablePackageBookingStatus,
	isPackageUsableOnDate,
	packageFreeExclusionSql,
	trainingRelationshipSql
} from '$lib/server/packageSemantics';
import type { PoolClient } from 'pg';

type SqlClient = Pick<PoolClient, 'query'>;

type Scope = 'client' | 'customer';

type DbPackageRow = {
	id: number | string;
	customer_id: number | string | null;
	customer_name: string | null;
	client_id: number | string | null;
	client_firstname: string | null;
	client_lastname: string | null;
	autogiro: boolean | null;
	frozen_from_date: string | null;
	invoice_numbers: Array<string | number> | null;
	first_payment_date: string | null;
	article_id: number | string | null;
	article_name: string | null;
	article_sessions: number | string | null;
	validity_start_date: string | null;
	validity_end_date: string | null;
};

type DbBookingRow = {
	id: number | string;
	start_time: string | null;
	status: string | null;
	client_id: number | string | null;
	client_name: string | null;
	trainer_name: string | null;
	location_name: string | null;
	package_id: number | string | null;
	added_to_package_date: string | null;
	internal: boolean | null;
	education: boolean | null;
	try_out: boolean | null;
	internal_education: boolean | null;
	current_package_customer_id: number | string | null;
	current_package_customer_name: string | null;
	current_package_article_name: string | null;
	current_package_client_name: string | null;
};

export type PackageAssignmentScope = Scope;

export type PackageAssignmentPackage = {
	id: number;
	customer_id: number;
	customer_name: string;
	client_id: number | null;
	client_name: string | null;
	article_id: number | null;
	article_name: string;
	autogiro: boolean;
	frozen_from_date: string | null;
	invoice_numbers: Array<string | number>;
	first_payment_date: string | null;
	validity_start_date: string | null;
	validity_end_date: string | null;
	total_sessions: number | null;
	used_sessions_total: number;
	remaining_sessions: number | null;
	is_personal: boolean;
	is_shared: boolean;
	label: string;
};

export type PackageAssignmentBooking = {
	id: number;
	start_time: string | null;
	booking_date: string | null;
	status: string | null;
	client_id: number;
	client_name: string;
	trainer_name: string | null;
	location_name: string | null;
	current_package_id: number | null;
	current_package_customer_id: number | null;
	current_package_label: string | null;
	added_to_package_date: string | null;
	internal_education: boolean;
	package_status: 'linked' | 'missing';
};

export type PackageAssignmentWorkspace = {
	scope: Scope;
	subject: {
		id: number;
		name: string;
	};
	packages: PackageAssignmentPackage[];
	bookings: PackageAssignmentBooking[];
	summary: {
		all: number;
		linked: number;
		missing: number;
	};
};

export type PackageAssignmentChange = {
	bookingId: number;
	targetPackageId: number | null;
};

export type PackageAssignmentValidationRow = {
	bookingId: number;
	currentPackageId: number | null;
	targetPackageId: number | null;
	ok: boolean;
	reason: string | null;
	changed: boolean;
};

export type PackageAssignmentValidation = {
	ok: boolean;
	rows: PackageAssignmentValidationRow[];
	effectiveChanges: PackageAssignmentChange[];
};

export type PackageAssignmentApplyResult = PackageAssignmentValidation & {
	appliedCount: number;
	changedBookingIds: number[];
};

const pool = (db as any).pool as { connect: () => Promise<PoolClient> };

function toIntOrNull(value: unknown) {
	if (value === null || value === undefined || value === '') return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function trimOrNull(value: unknown) {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : null;
}

function ymd(value: unknown) {
	if (typeof value !== 'string') return null;
	const match = value.match(/\d{4}-\d{2}-\d{2}/);
	return match ? match[0] : null;
}

function fullName(firstname: unknown, lastname: unknown) {
	return trimOrNull([trimOrNull(firstname), trimOrNull(lastname)].filter(Boolean).join(' '));
}

function normalizePackageIdInput(value: unknown) {
	const parsed = toIntOrNull(value);
	return parsed && parsed > 0 ? parsed : null;
}

function packageLabel(pkg: {
	article_name?: string | null;
	customer_name?: string | null;
	client_name?: string | null;
	client_id?: number | null;
}) {
	const articleName = trimOrNull(pkg.article_name) ?? 'Okänt paket';
	const ownerName = pkg.client_id ? trimOrNull(pkg.client_name) : trimOrNull(pkg.customer_name);
	return ownerName ? `${articleName} - ${ownerName}` : articleName;
}

async function runQuery(client: SqlClient | null, text: string, params: unknown[] = []) {
	if (client) {
		return (await (db as any).queryWithClient(client as PoolClient, text, params)) as any[];
	}
	return (await db.query(text, params)) as any[];
}

export function isAssignmentBookingRelevant(flags: {
	status?: string | null;
	client_id?: number | null;
	internal?: boolean | null;
	education?: boolean | null;
	try_out?: boolean | null;
}) {
	if (!flags.client_id) return false;
	if (!isChargeablePackageBookingStatus(flags.status ?? null)) return false;
	return bookingConsumesPackage({
		internal: flags.internal,
		education: flags.education,
		try_out: flags.try_out
	});
}

function mapPackages(
	rows: DbPackageRow[],
	counts: Record<number, number>,
	scope: Scope,
	scopeId: number
): PackageAssignmentPackage[] {
	return rows.map((row) => {
		const id = Number(row.id);
		const sessions = toIntOrNull(row.article_sessions);
		const used = counts[id] ?? 0;
		const clientId = toIntOrNull(row.client_id);
		const customerId = Number(row.customer_id ?? 0);
		const clientName = fullName(row.client_firstname, row.client_lastname);
		const remaining = sessions === null ? null : sessions - used;
		const isPersonal = scope === 'client' ? clientId === scopeId : clientId !== null;

		return {
			id,
			customer_id: customerId,
			customer_name: trimOrNull(row.customer_name) ?? 'Okänd kund',
			client_id: clientId,
			client_name: clientName,
			article_id: toIntOrNull(row.article_id),
			article_name: trimOrNull(row.article_name) ?? 'Okänt paket',
			autogiro: Boolean(row.autogiro),
			frozen_from_date: ymd(row.frozen_from_date),
			invoice_numbers: Array.isArray(row.invoice_numbers) ? row.invoice_numbers : [],
			first_payment_date: ymd(row.first_payment_date),
			validity_start_date: ymd(row.validity_start_date),
			validity_end_date: ymd(row.validity_end_date),
			total_sessions: sessions,
			used_sessions_total: used,
			remaining_sessions: remaining,
			is_personal: isPersonal,
			is_shared: clientId === null,
			label: packageLabel({
				article_name: row.article_name,
				customer_name: row.customer_name,
				client_name: clientName,
				client_id: clientId
			})
		};
	});
}

function mapBookings(rows: DbBookingRow[]): PackageAssignmentBooking[] {
	return rows
		.filter((row) =>
			isAssignmentBookingRelevant({
				status: row.status,
				client_id: toIntOrNull(row.client_id),
				internal: row.internal,
				education: row.education,
				try_out: row.try_out
			})
		)
		.map((row) => {
			const clientId = Number(row.client_id);
			const currentPackageId = toIntOrNull(row.package_id);
			const currentPackageCustomerId = toIntOrNull(row.current_package_customer_id);
			const currentPackageClientName = trimOrNull(row.current_package_client_name);

			return {
				id: Number(row.id),
				start_time: row.start_time,
				booking_date: getStockholmYmd(row.start_time),
				status: row.status,
				client_id: clientId,
				client_name: trimOrNull(row.client_name) ?? `Klient ${clientId}`,
				trainer_name: trimOrNull(row.trainer_name),
				location_name: trimOrNull(row.location_name),
				current_package_id: currentPackageId,
				current_package_customer_id: currentPackageCustomerId,
				current_package_label: currentPackageId
					? packageLabel({
						article_name: row.current_package_article_name,
						customer_name: row.current_package_customer_name,
						client_name: currentPackageClientName,
						client_id: currentPackageClientName ? 1 : null
					})
					: null,
				added_to_package_date: row.added_to_package_date,
				internal_education: Boolean(row.internal_education),
				package_status: currentPackageId ? 'linked' : 'missing'
			};
		});
}

async function fetchPackageUsageCounts(client: SqlClient | null, packageIds: number[]) {
	if (!packageIds.length) return {} as Record<number, number>;

	const rows = await runQuery(
		client,
		`
		SELECT b.package_id, COUNT(*)::int AS used_sessions_total
		FROM bookings b
		WHERE b.package_id = ANY($1::int[])
			AND ${chargeablePackageBookingSql('b')}
		GROUP BY b.package_id
		`,
		[packageIds]
	);

	return rows.reduce((acc: Record<number, number>, row: any) => {
		acc[Number(row.package_id)] = Number(row.used_sessions_total ?? 0);
		return acc;
	}, {});
}

async function loadClientWorkspace(client: SqlClient | null, clientId: number, lockPackages = false) {
	const [subject] = await runQuery(
		client,
		`SELECT id, firstname, lastname FROM clients WHERE id = $1`,
		[clientId]
	);
	if (!subject) {
		throw new Error('Client not found');
	}

	const packageRows = (await runQuery(
		client,
		`
		SELECT
			p.id,
			p.customer_id,
			cu.name AS customer_name,
			p.client_id,
			cl.firstname AS client_firstname,
			cl.lastname AS client_lastname,
			p.autogiro,
			p.frozen_from_date,
			p.invoice_numbers,
			p.first_payment_date,
			a.id AS article_id,
			a.name AS article_name,
			a.sessions AS article_sessions,
			a.validity_start_date,
			a.validity_end_date
		FROM packages p
		JOIN customers cu ON cu.id = p.customer_id
		LEFT JOIN clients cl ON cl.id = p.client_id
		LEFT JOIN articles a ON a.id = p.article_id
		WHERE p.client_id = $1
			OR (
				p.client_id IS NULL
				AND EXISTS (
					SELECT 1
					FROM client_customer_relationships ccr
					WHERE ccr.client_id = $1
						AND ccr.customer_id = p.customer_id
						AND ${trainingRelationshipSql('ccr')}
				)
			)
		ORDER BY p.first_payment_date ASC NULLS LAST, p.id ASC
		${lockPackages ? 'FOR UPDATE OF p' : ''}
		`,
		[clientId]
	)) as DbPackageRow[];

	const packageIds = packageRows.map((row) => Number(row.id));
	const counts = await fetchPackageUsageCounts(client, packageIds);
	const packages = mapPackages(packageRows, counts, 'client', clientId);

	const bookingRows = (await runQuery(
		client,
		`
		SELECT
			b.id,
			b.start_time,
			b.status,
			b.client_id,
			NULLIF(BTRIM(CONCAT_WS(' ', cl.firstname, cl.lastname)), '') AS client_name,
			NULLIF(BTRIM(CONCAT_WS(' ', u.firstname, u.lastname)), '') AS trainer_name,
			l.name AS location_name,
			b.package_id,
			b.added_to_package_date,
			b.internal,
			b.education,
			b.try_out,
			b.internal_education,
			cp.customer_id AS current_package_customer_id,
			ccu.name AS current_package_customer_name,
			ap.name AS current_package_article_name,
			NULLIF(BTRIM(CONCAT_WS(' ', pcl.firstname, pcl.lastname)), '') AS current_package_client_name
		FROM bookings b
		JOIN clients cl ON cl.id = b.client_id
		LEFT JOIN users u ON u.id = b.trainer_id
		LEFT JOIN locations l ON l.id = b.location_id
		LEFT JOIN packages cp ON cp.id = b.package_id
		LEFT JOIN customers ccu ON ccu.id = cp.customer_id
		LEFT JOIN articles ap ON ap.id = cp.article_id
		LEFT JOIN clients pcl ON pcl.id = cp.client_id
		WHERE b.client_id = $1
			AND ${chargeablePackageBookingSql('b')}
			AND ${packageFreeExclusionSql('b')}
		ORDER BY b.start_time DESC NULLS LAST, b.id DESC
		`,
		[clientId]
	)) as DbBookingRow[];

	const bookings = mapBookings(bookingRows);
	const subjectName = fullName(subject.firstname, subject.lastname) ?? `Klient ${clientId}`;

	return {
		scope: 'client' as const,
		subject: { id: clientId, name: subjectName },
		packages,
		bookings,
		summary: {
			all: bookings.length,
			linked: bookings.filter((booking) => booking.current_package_id !== null).length,
			missing: bookings.filter((booking) => booking.current_package_id === null).length
		}
	};
}

async function loadCustomerWorkspace(client: SqlClient | null, customerId: number, lockPackages = false) {
	const [subject] = await runQuery(
		client,
		`SELECT id, name FROM customers WHERE id = $1`,
		[customerId]
	);
	if (!subject) {
		throw new Error('Customer not found');
	}

	const packageRows = (await runQuery(
		client,
		`
		SELECT
			p.id,
			p.customer_id,
			cu.name AS customer_name,
			p.client_id,
			cl.firstname AS client_firstname,
			cl.lastname AS client_lastname,
			p.autogiro,
			p.frozen_from_date,
			p.invoice_numbers,
			p.first_payment_date,
			a.id AS article_id,
			a.name AS article_name,
			a.sessions AS article_sessions,
			a.validity_start_date,
			a.validity_end_date
		FROM packages p
		JOIN customers cu ON cu.id = p.customer_id
		LEFT JOIN clients cl ON cl.id = p.client_id
		LEFT JOIN articles a ON a.id = p.article_id
		WHERE p.customer_id = $1
		ORDER BY p.client_id ASC NULLS FIRST, p.first_payment_date ASC NULLS LAST, p.id ASC
		${lockPackages ? 'FOR UPDATE OF p' : ''}
		`,
		[customerId]
	)) as DbPackageRow[];

	const packageIds = packageRows.map((row) => Number(row.id));
	const counts = await fetchPackageUsageCounts(client, packageIds);
	const packages = mapPackages(packageRows, counts, 'customer', customerId);

	const bookingRows = (await runQuery(
		client,
		`
		SELECT
			b.id,
			b.start_time,
			b.status,
			b.client_id,
			NULLIF(BTRIM(CONCAT_WS(' ', cl.firstname, cl.lastname)), '') AS client_name,
			NULLIF(BTRIM(CONCAT_WS(' ', u.firstname, u.lastname)), '') AS trainer_name,
			l.name AS location_name,
			b.package_id,
			b.added_to_package_date,
			b.internal,
			b.education,
			b.try_out,
			b.internal_education,
			cp.customer_id AS current_package_customer_id,
			ccu.name AS current_package_customer_name,
			ap.name AS current_package_article_name,
			NULLIF(BTRIM(CONCAT_WS(' ', pcl.firstname, pcl.lastname)), '') AS current_package_client_name
		FROM bookings b
		JOIN clients cl ON cl.id = b.client_id
		LEFT JOIN users u ON u.id = b.trainer_id
		LEFT JOIN locations l ON l.id = b.location_id
		LEFT JOIN packages cp ON cp.id = b.package_id
		LEFT JOIN customers ccu ON ccu.id = cp.customer_id
		LEFT JOIN articles ap ON ap.id = cp.article_id
		LEFT JOIN clients pcl ON pcl.id = cp.client_id
		WHERE EXISTS (
				SELECT 1
				FROM client_customer_relationships ccr
				WHERE ccr.customer_id = $1
					AND ccr.client_id = b.client_id
					AND ${trainingRelationshipSql('ccr')}
			)
			AND ${chargeablePackageBookingSql('b')}
			AND ${packageFreeExclusionSql('b')}
			AND (b.package_id IS NULL OR cp.customer_id = $1)
		ORDER BY b.start_time DESC NULLS LAST, b.id DESC
		`,
		[customerId]
	)) as DbBookingRow[];

	const bookings = mapBookings(bookingRows);

	return {
		scope: 'customer' as const,
		subject: { id: customerId, name: trimOrNull(subject.name) ?? `Kund ${customerId}` },
		packages,
		bookings,
		summary: {
			all: bookings.length,
			linked: bookings.filter((booking) => booking.current_package_id !== null).length,
			missing: bookings.filter((booking) => booking.current_package_id === null).length
		}
	};
}

export async function loadPackageAssignmentWorkspace({
	scope,
	scopeId,
	client = null,
	lockPackages = false
}: {
	scope: Scope;
	scopeId: number;
	client?: SqlClient | null;
	lockPackages?: boolean;
}): Promise<PackageAssignmentWorkspace> {
	if (scope === 'client') {
		return loadClientWorkspace(client, scopeId, lockPackages);
	}
	return loadCustomerWorkspace(client, scopeId, lockPackages);
}

function normalizeChanges(changes: PackageAssignmentChange[]) {
	const unique = new Map<number, PackageAssignmentChange>();

	for (const item of changes ?? []) {
		const bookingId = toIntOrNull(item?.bookingId);
		if (!bookingId || bookingId <= 0) continue;
		unique.set(bookingId, {
			bookingId,
			targetPackageId: normalizePackageIdInput(item?.targetPackageId)
		});
	}

	return [...unique.values()];
}

export function validatePackageAssignmentChanges({
	packages,
	bookings,
	changes
}: {
	packages: PackageAssignmentPackage[];
	bookings: PackageAssignmentBooking[];
	changes: PackageAssignmentChange[];
}): PackageAssignmentValidation {
	const normalized = normalizeChanges(changes);
	const packageMap = new Map(packages.map((pkg) => [pkg.id, pkg]));
	const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));
	const projectedUsage = new Map(packages.map((pkg) => [pkg.id, pkg.used_sessions_total]));

	for (const change of normalized) {
		const booking = bookingMap.get(change.bookingId);
		if (!booking) continue;

		const currentPackageId = booking.current_package_id;
		if (currentPackageId && currentPackageId !== change.targetPackageId && projectedUsage.has(currentPackageId)) {
			projectedUsage.set(currentPackageId, Math.max(0, Number(projectedUsage.get(currentPackageId) ?? 0) - 1));
		}

		if (change.targetPackageId && change.targetPackageId !== currentPackageId && projectedUsage.has(change.targetPackageId)) {
			projectedUsage.set(change.targetPackageId, Number(projectedUsage.get(change.targetPackageId) ?? 0) + 1);
		}
	}

	const rows = normalized.map<PackageAssignmentValidationRow>((change) => {
		const booking = bookingMap.get(change.bookingId);
		if (!booking) {
			return {
				bookingId: change.bookingId,
				currentPackageId: null,
				targetPackageId: change.targetPackageId,
				ok: false,
				reason: 'Bokningen kunde inte hittas i den här vyn.',
				changed: false
			};
		}

		const currentPackageId = booking.current_package_id;
		if (change.targetPackageId === currentPackageId) {
			return {
				bookingId: change.bookingId,
				currentPackageId,
				targetPackageId: change.targetPackageId,
				ok: true,
				reason: null,
				changed: false
			};
		}

		if (change.targetPackageId === null) {
			return {
				bookingId: change.bookingId,
				currentPackageId,
				targetPackageId: null,
				ok: true,
				reason: null,
				changed: true
			};
		}

		const targetPackage = packageMap.get(change.targetPackageId);
		if (!targetPackage) {
			return {
				bookingId: change.bookingId,
				currentPackageId,
				targetPackageId: change.targetPackageId,
				ok: false,
				reason: 'Målpaketet finns inte i den här vyn.',
				changed: false
			};
		}

		if (targetPackage.client_id && targetPackage.client_id !== booking.client_id) {
			return {
				bookingId: change.bookingId,
				currentPackageId,
				targetPackageId: change.targetPackageId,
				ok: false,
				reason: 'Bokningen kan inte läggas på ett personligt paket som tillhör en annan klient.',
				changed: false
			};
		}

		const bookingDate = booking.booking_date;
		if (!bookingDate) {
			return {
				bookingId: change.bookingId,
				currentPackageId,
				targetPackageId: change.targetPackageId,
				ok: false,
				reason: 'Bokningen saknar giltigt datum.',
				changed: false
			};
		}

		if (
			!isPackageUsableOnDate(
				{
					frozen_from_date: targetPackage.frozen_from_date,
					validity_start_date: targetPackage.validity_start_date,
					validity_end_date: targetPackage.validity_end_date
				},
				bookingDate
			)
		) {
			return {
				bookingId: change.bookingId,
				currentPackageId,
				targetPackageId: change.targetPackageId,
				ok: false,
				reason: 'Paketet är inte giltigt för bokningens datum.',
				changed: false
			};
		}

		const totalSessions = targetPackage.total_sessions;
		if (totalSessions === null || totalSessions <= 0) {
			return {
				bookingId: change.bookingId,
				currentPackageId,
				targetPackageId: change.targetPackageId,
				ok: false,
				reason: 'Paketet saknar tillgängliga pass.',
				changed: false
			};
		}

		const projectedCount = Number(projectedUsage.get(targetPackage.id) ?? 0);
		if (projectedCount > totalSessions) {
			return {
				bookingId: change.bookingId,
				currentPackageId,
				targetPackageId: change.targetPackageId,
				ok: false,
				reason: 'Paketet har inte tillräckligt saldo för den här ändringen.',
				changed: false
			};
		}

		return {
			bookingId: change.bookingId,
			currentPackageId,
			targetPackageId: change.targetPackageId,
			ok: true,
			reason: null,
			changed: true
		};
	});

	const effectiveChanges = rows
		.filter((row) => row.ok && row.changed)
		.map((row) => ({ bookingId: row.bookingId, targetPackageId: row.targetPackageId }));

	return {
		ok: rows.every((row) => row.ok),
		rows,
		effectiveChanges
	};
}

export async function validateScopedPackageAssignmentChanges({
	scope,
	scopeId,
	changes,
	client = null,
	lockPackages = false
}: {
	scope: Scope;
	scopeId: number;
	changes: PackageAssignmentChange[];
	client?: SqlClient | null;
	lockPackages?: boolean;
}) {
	const workspace = await loadPackageAssignmentWorkspace({
		scope,
		scopeId,
		client,
		lockPackages
	});

	const validation = validatePackageAssignmentChanges({
		packages: workspace.packages,
		bookings: workspace.bookings,
		changes
	});

	return {
		workspace,
		validation
	};
}

export async function applyScopedPackageAssignmentChanges({
	scope,
	scopeId,
	changes,
	actorUserId
}: {
	scope: Scope;
	scopeId: number;
	changes: PackageAssignmentChange[];
	actorUserId?: number | null;
}): Promise<PackageAssignmentApplyResult> {
	const client = await pool.connect();
	let inTx = false;

	try {
		await client.query('BEGIN');
		inTx = true;

		const { validation } = await validateScopedPackageAssignmentChanges({
			scope,
			scopeId,
			changes,
			client,
			lockPackages: true
		});

		if (!validation.ok) {
			await client.query('ROLLBACK');
			inTx = false;
			return {
				...validation,
				appliedCount: 0,
				changedBookingIds: []
			};
		}

		for (const change of validation.effectiveChanges) {
			if (change.targetPackageId === null) {
				await runQuery(
					client,
					`
					UPDATE bookings
					SET package_id = NULL,
						added_to_package_date = NULL,
						added_to_package_by = NULL,
						updated_at = NOW()
					WHERE id = $1
					`,
					[change.bookingId]
				);
				continue;
			}

			await runQuery(
				client,
				`
				UPDATE bookings
				SET package_id = $2,
					added_to_package_date = NOW(),
					added_to_package_by = $3,
					updated_at = NOW()
				WHERE id = $1
				`,
				[change.bookingId, change.targetPackageId, actorUserId ?? null]
			);
		}

		await client.query('COMMIT');
		inTx = false;

		return {
			...validation,
			appliedCount: validation.effectiveChanges.length,
			changedBookingIds: validation.effectiveChanges.map((change) => change.bookingId)
		};
	} catch (error) {
		if (inTx) {
			try {
				await client.query('ROLLBACK');
			} catch (rollbackError) {
				console.error('Failed rollback during package assignment apply:', rollbackError);
			}
		}
		throw error;
	} finally {
		client.release();
	}
}
