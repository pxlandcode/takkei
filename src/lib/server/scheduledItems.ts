import * as db from '$lib/db';
import type { PoolClient } from 'pg';

type SqlClient = Pick<PoolClient, 'query'>;

async function runQuery(client: SqlClient, text: string, params: unknown[] = []) {
	return (await (db as any).queryWithClient(client as PoolClient, text, params)) as any[];
}

export async function enqueuePackageReallocation({
	client,
	clientId,
	createdByEvent = 'saldojustering'
}: {
	client: SqlClient;
	clientId: number;
	createdByEvent?: string;
}) {
	if (!Number.isInteger(clientId) || clientId <= 0) return;

	await runQuery(
		client,
		`
		INSERT INTO scheduled_items (
			function_to_call,
			target_type,
			target_id,
			created_by_event,
			created_at,
			updated_at
		)
		SELECT
			'package_reallocation',
			'Client',
			$1::int,
			$2,
			NOW(),
			NOW()
		WHERE NOT EXISTS (
			SELECT 1
			FROM scheduled_items
			WHERE function_to_call = 'package_reallocation'
				AND target_type = 'Client'
				AND target_id = $1::int
		)
		`,
		[clientId, createdByEvent]
	);
}
