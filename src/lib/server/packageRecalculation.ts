import * as db from '$lib/db';
import {
	bookingConsumesPackage,
	isChargeablePackageBookingStatus
} from '$lib/server/packageSemantics';
import type { PoolClient } from 'pg';

type SqlClient = Pick<PoolClient, 'query'>;

export type PackageRecalculationResult = {
	packageId: number;
	dryRun: boolean;
	totalAttached: number;
	chargeableAttached: number;
	packageSessions: number | null;
	keptChargeable: number;
	detachedPackageFreeChargeableCount: number;
	detachedOverflowChargeableCount: number;
	detachedCount: number;
	detachedBookingIds: number[];
};

export type PackageBatchRecalculationItem = {
	packageId: number;
	ok: boolean;
	result?: PackageRecalculationResult;
	error?: string;
};

export type PackageBatchRecalculationResult = {
	dryRun: boolean;
	totalPackages: number;
	processedPackages: number;
	failedPackages: number;
	changedPackages: number;
	totalDetachedCount: number;
	items: PackageBatchRecalculationItem[];
};

type AttachedBookingRow = {
	id: number;
	status: string | null;
	start_time: string | null;
	internal: boolean | null;
	education: boolean | null;
	try_out: boolean | null;
};

async function txQuery(client: SqlClient, text: string, params: unknown[] = []) {
	return (await (db as any).queryWithClient(client as PoolClient, text, params)) as any[];
}

function toIntOrNull(value: unknown) {
	if (value === null || value === undefined) return null;
	const n = Number(value);
	return Number.isFinite(n) ? Math.trunc(n) : null;
}

function uniqNumbers(values: number[]) {
	return Array.from(new Set(values.filter((v) => Number.isInteger(v))));
}

export async function recalculatePackageAssignments({
	client,
	packageId,
	dryRun = false
}: {
	client: SqlClient;
	packageId: number;
	dryRun?: boolean;
}): Promise<PackageRecalculationResult> {
	const packageRows = await txQuery(
		client,
		`
		SELECT p.id, a.sessions AS article_sessions
		FROM packages p
		LEFT JOIN articles a ON a.id = p.article_id
		WHERE p.id = $1
		FOR UPDATE OF p
		`,
		[packageId]
	);

	if (!packageRows.length) {
		throw new Error('Package not found');
	}

	const packageSessions = toIntOrNull(packageRows[0].article_sessions);

	const attachedRows = (await txQuery(
		client,
		`
		SELECT id, status, start_time, internal, education, try_out
		FROM bookings
		WHERE package_id = $1
		ORDER BY start_time ASC NULLS LAST, id ASC
		`,
		[packageId]
	)) as AttachedBookingRow[];

	const chargeable = attachedRows.filter((row) => isChargeablePackageBookingStatus(row.status));

	const chargeablePackageFree = chargeable.filter(
		(row) =>
			!bookingConsumesPackage({
				internal: row.internal,
				education: row.education,
				try_out: row.try_out
			})
	);

	const eligibleChargeable = chargeable.filter((row) =>
		bookingConsumesPackage({
			internal: row.internal,
			education: row.education,
			try_out: row.try_out
		})
	);

	let keptChargeableRows = eligibleChargeable;
	let overflowChargeableRows: AttachedBookingRow[] = [];

	if (packageSessions !== null && packageSessions >= 0) {
		keptChargeableRows = eligibleChargeable.slice(0, packageSessions);
		overflowChargeableRows = eligibleChargeable.slice(packageSessions);
	}

	const detachedBookingIds = uniqNumbers([
		...chargeablePackageFree.map((row) => Number(row.id)),
		...overflowChargeableRows.map((row) => Number(row.id))
	]);

	if (!dryRun && detachedBookingIds.length > 0) {
		await txQuery(
			client,
			`UPDATE bookings
			 SET package_id = NULL,
			     added_to_package_date = NULL,
			     added_to_package_by = NULL,
			     updated_at = NOW()
			 WHERE id = ANY($1::int[])`,
			[detachedBookingIds]
		);
	}

	return {
		packageId,
		dryRun,
		totalAttached: attachedRows.length,
		chargeableAttached: chargeable.length,
		packageSessions,
		keptChargeable: keptChargeableRows.length,
		detachedPackageFreeChargeableCount: chargeablePackageFree.length,
		detachedOverflowChargeableCount: overflowChargeableRows.length,
		detachedCount: detachedBookingIds.length,
		detachedBookingIds
	};
}

export async function recalculatePackagesBatch({
	packageIds,
	dryRun = false
}: {
	packageIds: number[];
	dryRun?: boolean;
}): Promise<PackageBatchRecalculationResult> {
	const normalizedIds = uniqNumbers(
		(packageIds ?? []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
	);

	const pool = (db as any).pool as { connect: () => Promise<PoolClient> };
	const client = await pool.connect();
	let inTx = false;

	try {
		const items: PackageBatchRecalculationItem[] = [];

		for (const packageId of normalizedIds) {
			try {
				await client.query('BEGIN');
				inTx = true;

				const result = await recalculatePackageAssignments({
					client,
					packageId,
					dryRun
				});

				await client.query('COMMIT');
				inTx = false;
				items.push({ packageId, ok: true, result });
			} catch (error) {
				if (inTx) {
					try {
						await client.query('ROLLBACK');
					} catch (rollbackError) {
						console.error('Failed rollback during package batch recalculation:', rollbackError);
					}
					inTx = false;
				}

				items.push({
					packageId,
					ok: false,
					error: (error as Error)?.message || 'Failed to recalculate package'
				});
			}
		}

		const processed = items.filter((item) => item.ok);
		const failed = items.filter((item) => !item.ok);
		const changedPackages = processed.filter((item) => (item.result?.detachedCount ?? 0) > 0).length;
		const totalDetachedCount = processed.reduce(
			(sum, item) => sum + Number(item.result?.detachedCount ?? 0),
			0
		);

		return {
			dryRun,
			totalPackages: normalizedIds.length,
			processedPackages: processed.length,
			failedPackages: failed.length,
			changedPackages,
			totalDetachedCount,
			items
		};
	} finally {
		client.release();
	}
}
