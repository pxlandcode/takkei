import * as db from '$lib/db';
import { recalculatePackageAssignments } from '$lib/server/packageRecalculation';
import type { PoolClient } from 'pg';

const pool = (db as any).pool as { connect: () => Promise<PoolClient> };

function parseBoolean(value: unknown) {
	if (value === true || value === 'true' || value === 1 || value === '1') return true;
	return false;
}

export async function POST({ params, request }) {
	const packageId = Number(params.id);
	if (!Number.isInteger(packageId) || packageId <= 0) {
		return new Response(JSON.stringify({ error: 'Invalid package id' }), { status: 400 });
	}

	let body: any = {};
	try {
		body = await request.json();
	} catch {
		body = {};
	}
	const dryRun = parseBoolean(body?.dry_run);

	const client = await pool.connect();
	let inTx = false;
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

		const summary = [
			result.detachedCount > 0
				? `Detached ${result.detachedCount} booking(s)`
				: 'No changes needed',
			`overflow removed: ${result.detachedOverflowChargeableCount}`,
			`package-free removed: ${result.detachedPackageFreeChargeableCount}`
		].join(', ');

		return new Response(
			JSON.stringify({
				ok: true,
				...result,
				message: summary
			}),
			{ status: 200 }
		);
	} catch (error) {
		if (inTx) {
			try {
				await client.query('ROLLBACK');
			} catch (rollbackError) {
				console.error('Failed to rollback package recalculation:', rollbackError);
			}
		}

		const message = (error as Error)?.message || 'Failed to recalculate package';
		const status = message === 'Package not found' ? 404 : 500;
		console.error('Package recalculation failed:', error);
		return new Response(JSON.stringify({ error: message }), { status });
	} finally {
		client.release();
	}
}

