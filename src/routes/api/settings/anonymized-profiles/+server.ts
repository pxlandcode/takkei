import { json, type RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { resolveAdministratorRequest } from '$lib/server/adminAccess';

type AnonymizedProfileRow = {
	lifecycle_id: number;
	profile_type: 'client' | 'customer';
	profile_id: number;
	display_name: string;
	gdpr_deleted_at: string;
	gdpr_delete_token: string | null;
	merged_into_id: number | null;
	merged_into_name: string | null;
	deleted_by_name: string | null;
};

export const GET: RequestHandler = async ({ locals }) => {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) {
		return json({ error: admin.message }, { status: admin.status });
	}

	try {
		const rows = await query<AnonymizedProfileRow>(
			`
			SELECT
				lifecycle.id AS lifecycle_id,
				lifecycle.profile_type,
				CASE
					WHEN lifecycle.profile_type = 'client' THEN lifecycle.client_id
					ELSE lifecycle.customer_id
				END AS profile_id,
				CASE
					WHEN lifecycle.profile_type = 'client' THEN
						COALESCE(NULLIF(TRIM(CONCAT_WS(' ', client.firstname, client.lastname)), ''), 'Klient ' || lifecycle.client_id::text)
					ELSE
						COALESCE(NULLIF(customer.name, ''), 'Kund ' || lifecycle.customer_id::text)
				END AS display_name,
				lifecycle.gdpr_deleted_at,
				lifecycle.gdpr_delete_token,
				CASE
					WHEN lifecycle.profile_type = 'client' THEN lifecycle.merged_into_client_id
					ELSE lifecycle.merged_into_customer_id
				END AS merged_into_id,
				CASE
					WHEN lifecycle.profile_type = 'client' AND lifecycle.merged_into_client_id IS NOT NULL THEN
						COALESCE(NULLIF(TRIM(CONCAT_WS(' ', target_client.firstname, target_client.lastname)), ''), 'Klient ' || lifecycle.merged_into_client_id::text)
					WHEN lifecycle.profile_type = 'customer' AND lifecycle.merged_into_customer_id IS NOT NULL THEN
						COALESCE(NULLIF(target_customer.name, ''), 'Kund ' || lifecycle.merged_into_customer_id::text)
					ELSE NULL
				END AS merged_into_name,
				NULLIF(TRIM(CONCAT_WS(' ', deleted_by.firstname, deleted_by.lastname)), '') AS deleted_by_name
			FROM gdpr_profile_lifecycle lifecycle
			LEFT JOIN clients client
			  ON lifecycle.profile_type = 'client'
			 AND lifecycle.client_id = client.id
			LEFT JOIN customers customer
			  ON lifecycle.profile_type = 'customer'
			 AND lifecycle.customer_id = customer.id
			LEFT JOIN clients target_client
			  ON lifecycle.profile_type = 'client'
			 AND lifecycle.merged_into_client_id = target_client.id
			LEFT JOIN customers target_customer
			  ON lifecycle.profile_type = 'customer'
			 AND lifecycle.merged_into_customer_id = target_customer.id
			LEFT JOIN users deleted_by
			  ON lifecycle.gdpr_deleted_by_user_id = deleted_by.id
			WHERE lifecycle.gdpr_deleted_at IS NOT NULL
			ORDER BY lifecycle.gdpr_deleted_at DESC, lifecycle.id DESC
			`
		);

		return json(rows);
	} catch (error) {
		console.error('Error fetching anonymized profiles:', error);
		return json({ error: 'Kunde inte hämta anonymiserade profiler' }, { status: 500 });
	}
};
