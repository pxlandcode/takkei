import { query } from '$lib/db';
import { recalculatePackagesBatch } from '$lib/server/packageRecalculation';

function parseBoolean(value: unknown) {
	return value === true || value === 'true' || value === 1 || value === '1';
}

export async function POST({ params, request }) {
	const customerId = Number(params.id);
	if (!Number.isInteger(customerId) || customerId <= 0) {
		return new Response(JSON.stringify({ error: 'Invalid customer id' }), { status: 400 });
	}

	let body: any = {};
	try {
		body = await request.json();
	} catch {
		body = {};
	}
	const dryRun = parseBoolean(body?.dry_run);

	try {
		const rows = await query(
			`SELECT id FROM packages WHERE customer_id = $1 ORDER BY id ASC`,
			[customerId]
		);
		const packageIds = rows.map((row: any) => Number(row.id)).filter((id) => Number.isInteger(id));
		const result = await recalculatePackagesBatch({ packageIds, dryRun });

		const message =
			result.totalPackages === 0
				? 'No packages found for this customer'
				: `Recalculated ${result.processedPackages}/${result.totalPackages} package(s), detached ${result.totalDetachedCount} booking(s)`;

		return new Response(JSON.stringify({ ok: true, ...result, message }), { status: 200 });
	} catch (error) {
		console.error('Customer package recalculation failed:', error);
		return new Response(
			JSON.stringify({
				error: (error as Error)?.message || 'Failed to recalculate customer packages'
			}),
			{ status: 500 }
		);
	}
}

