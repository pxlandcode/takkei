import * as db from '$lib/db';
import { resolvePackageAssignmentForCreate } from '$lib/server/createBookingPackageAssignment';
import {
	chargeablePackageBookingSql,
	getStockholmYmd,
	packageFreeExclusionSql,
	trainingRelationshipSql
} from '$lib/server/packageSemantics';
import type { PoolClient } from 'pg';

type SqlClient = Pick<PoolClient, 'query'>;

type TrainingScope = {
	clientIds: number[];
	customerIds: number[];
};

type FutureBookingRow = {
	id: number | string;
	client_id: number | string;
	start_time: string | null;
	added_to_package_date: Date | string | null;
	added_to_package_by: string | null;
};

export type PackageReallocationResult = {
	clientId: number;
	scopeClientIds: number[];
	scopeCustomerIds: number[];
	clearedFutureBookings: number;
	eligibleFutureBookings: number;
	assignedFutureBookings: number;
	unassignedFutureBookings: number;
	skippedFutureBookings: number;
};

async function runQuery(client: SqlClient, text: string, params: unknown[] = []) {
	return (await (db as any).queryWithClient(client as PoolClient, text, params)) as any[];
}

function uniqSorted(values: Iterable<number>) {
	return [...new Set([...values].filter((value) => Number.isInteger(value) && value > 0))].sort(
		(a, b) => a - b
	);
}

async function resolveTrainingScope(
	client: SqlClient,
	rootClientId: number
): Promise<TrainingScope> {
	const clientIds = new Set<number>([rootClientId]);
	const customerIds = new Set<number>();
	let pendingClientIds = [rootClientId];
	let pendingCustomerIds: number[] = [];

	while (pendingClientIds.length || pendingCustomerIds.length) {
		if (pendingClientIds.length) {
			const rows = await runQuery(
				client,
				`
				SELECT DISTINCT ccr.customer_id::int AS customer_id
				FROM client_customer_relationships ccr
				WHERE ccr.client_id = ANY($1::int[])
					AND ccr.customer_id IS NOT NULL
					AND ${trainingRelationshipSql('ccr')}
				`,
				[pendingClientIds]
			);

			pendingClientIds = [];
			for (const row of rows) {
				const customerId = Number(row.customer_id);
				if (Number.isInteger(customerId) && customerId > 0 && !customerIds.has(customerId)) {
					customerIds.add(customerId);
					pendingCustomerIds.push(customerId);
				}
			}
		}

		if (pendingCustomerIds.length) {
			const rows = await runQuery(
				client,
				`
				SELECT DISTINCT ccr.client_id::int AS client_id
				FROM client_customer_relationships ccr
				JOIN clients cl ON cl.id = ccr.client_id
				WHERE ccr.customer_id = ANY($1::int[])
					AND ccr.client_id IS NOT NULL
					AND cl.active = TRUE
					AND ${trainingRelationshipSql('ccr')}
				`,
				[pendingCustomerIds]
			);

			pendingCustomerIds = [];
			for (const row of rows) {
				const clientId = Number(row.client_id);
				if (Number.isInteger(clientId) && clientId > 0 && !clientIds.has(clientId)) {
					clientIds.add(clientId);
					pendingClientIds.push(clientId);
				}
			}
		}
	}

	return {
		clientIds: uniqSorted(clientIds),
		customerIds: uniqSorted(customerIds)
	};
}

async function lockScopePackages(client: SqlClient, scope: TrainingScope) {
	await runQuery(
		client,
		`
		SELECT p.id
		FROM packages p
		WHERE p.client_id = ANY($1::int[])
			OR (
				p.client_id IS NULL
				AND p.customer_id = ANY($2::int[])
			)
		FOR UPDATE OF p
		`,
		[scope.clientIds, scope.customerIds]
	);
}

async function loadEligibleFutureBookings(client: SqlClient, clientIds: number[]) {
	return (await runQuery(
		client,
		`
		SELECT
			b.id,
			b.client_id,
			b.start_time,
			b.added_to_package_date,
			b.added_to_package_by
		FROM bookings b
		WHERE b.client_id = ANY($1::int[])
			AND b.start_time > NOW()
			AND ${chargeablePackageBookingSql('b')}
			AND ${packageFreeExclusionSql('b')}
		ORDER BY b.start_time ASC, b.id ASC
		FOR UPDATE OF b
		`,
		[clientIds]
	)) as FutureBookingRow[];
}

async function clearFuturePackageAssignments(client: SqlClient, clientIds: number[]) {
	const rows = await runQuery(
		client,
		`
		UPDATE bookings b
		SET package_id = NULL,
			added_to_package_date = NULL,
			added_to_package_by = NULL,
			updated_at = NOW()
		WHERE b.client_id = ANY($1::int[])
			AND b.start_time > NOW()
			AND b.package_id IS NOT NULL
		RETURNING b.id
		`,
		[clientIds]
	);

	return rows.length;
}

export async function reallocateFuturePackageAssignmentsForClient({
	client,
	clientId,
	actorUserId = null
}: {
	client: SqlClient;
	clientId: number;
	actorUserId?: number | null;
}): Promise<PackageReallocationResult> {
	if (!Number.isInteger(clientId) || clientId <= 0) {
		throw new Error('Invalid client id for package reallocation');
	}

	const scope = await resolveTrainingScope(client, clientId);
	await lockScopePackages(client, scope);

	const futureBookings = await loadEligibleFutureBookings(client, scope.clientIds);
	const clearedFutureBookings = await clearFuturePackageAssignments(client, scope.clientIds);

	let assignedFutureBookings = 0;
	let skippedFutureBookings = 0;

	for (const booking of futureBookings) {
		const bookingClientId = Number(booking.client_id);
		const checkYmd = getStockholmYmd(booking.start_time);

		if (!Number.isInteger(bookingClientId) || bookingClientId <= 0 || !checkYmd) {
			skippedFutureBookings += 1;
			continue;
		}

		const packageAssignment = await resolvePackageAssignmentForCreate({
			client,
			clientId: bookingClientId,
			explicitPackageId: null,
			bookingNeedsPackage: true,
			bookingIsChargeable: true,
			checkYmd,
			initialAddedToPackageDate: booking.added_to_package_date ?? null
		});

		if (!packageAssignment.packageId) continue;

		await runQuery(
			client,
			`
			UPDATE bookings
			SET package_id = $2,
				added_to_package_date = $3,
				added_to_package_by = $4,
				updated_at = NOW()
			WHERE id = $1
			`,
			[
				Number(booking.id),
				packageAssignment.packageId,
				packageAssignment.addedToPackageDate,
				booking.added_to_package_by ?? (actorUserId ? String(actorUserId) : null)
			]
		);

		assignedFutureBookings += 1;
	}

	return {
		clientId,
		scopeClientIds: scope.clientIds,
		scopeCustomerIds: scope.customerIds,
		clearedFutureBookings,
		eligibleFutureBookings: futureBookings.length,
		assignedFutureBookings,
		unassignedFutureBookings:
			futureBookings.length - assignedFutureBookings - skippedFutureBookings,
		skippedFutureBookings
	};
}
