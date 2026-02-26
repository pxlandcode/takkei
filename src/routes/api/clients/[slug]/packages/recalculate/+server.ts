import { query } from '$lib/db';
import { recalculatePackagesBatch } from '$lib/server/packageRecalculation';
import { getStockholmYmd, trainingRelationshipSql } from '$lib/server/packageSemantics';

function parseBoolean(value: unknown) {
	return value === true || value === 'true' || value === 1 || value === '1';
}

export async function POST({ params, request }) {
	const clientId = Number(params.slug);
	if (!Number.isInteger(clientId) || clientId <= 0) {
		return new Response(JSON.stringify({ error: 'Invalid client id' }), { status: 400 });
	}

	let body: any = {};
	try {
		body = await request.json();
	} catch {
		body = {};
	}
	const dryRun = parseBoolean(body?.dry_run);

	const todayYmd = getStockholmYmd(new Date());
	if (!todayYmd) {
		return new Response(JSON.stringify({ error: 'Failed to determine business date' }), {
			status: 500
		});
	}

	try {
		// Match the client package list scope: all personal + currently eligible shared packages.
		const rows = await query(
			`
			SELECT p.id
			FROM packages p
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
					AND (p.frozen_from_date IS NULL OR p.frozen_from_date > $2::date)
					AND (a.validity_start_date IS NULL OR a.validity_start_date <= $2::date)
					AND (a.validity_end_date IS NULL OR a.validity_end_date >= $2::date)
			   )
			ORDER BY p.id ASC
			`,
			[clientId, todayYmd]
		);

		const packageIds = rows.map((row: any) => Number(row.id)).filter((id) => Number.isInteger(id));
		const result = await recalculatePackagesBatch({ packageIds, dryRun });

		const message =
			result.totalPackages === 0
				? 'No packages found for this client'
				: `Recalculated ${result.processedPackages}/${result.totalPackages} package(s), detached ${result.totalDetachedCount} booking(s)`;

		return new Response(JSON.stringify({ ok: true, ...result, message }), { status: 200 });
	} catch (error) {
		console.error('Client package recalculation failed:', error);
		return new Response(
			JSON.stringify({ error: (error as Error)?.message || 'Failed to recalculate client packages' }),
			{ status: 500 }
		);
	}
}

