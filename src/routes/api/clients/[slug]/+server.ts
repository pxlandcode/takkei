import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import { Argon2id } from 'oslo/password';
import { clientKeyId, clientUserId } from '$lib/server/auth';
import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import {
	deleteClientProfile,
	ProfileLifecycleError,
	resolveLifecycleActorId,
	withProfileLifecycleTransaction
} from '$lib/server/profileLifecycle';
import {
	assertProfileNotGdprDeleted,
	ProfileLifecycleGuardError
} from '$lib/server/profileLifecycleGuards';

const argon = new Argon2id();
const HASH_METADATA = { algo: 'argon2id', version: 1 };

async function updateClientPassword(clientId: number, email: string, password: string) {
	const luciaUserId = clientUserId(clientId);
	await query(
		`INSERT INTO auth_user (id, email, kind, trainer_id, client_id)
		 VALUES ($1, $2, 'client', NULL, $3)
		 ON CONFLICT (id)
		 DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()`,
		[luciaUserId, email, clientId]
	);

	const hashed = await argon.hash(password);
	const providerUserId = clientKeyId(email);
	const keyId = `email:${providerUserId}`;
	await query(
		`INSERT INTO auth_key (id, user_id, hashed_password, provider_id, provider_user_id, metadata)
		 VALUES ($1, $2, $3, 'email', $4, $5::jsonb)
		 ON CONFLICT (provider_id, provider_user_id)
		 DO UPDATE SET hashed_password = EXCLUDED.hashed_password, user_id = EXCLUDED.user_id, metadata = EXCLUDED.metadata`,
		[keyId, luciaUserId, hashed, providerUserId, JSON.stringify(HASH_METADATA)]
	);
}

/**
 * Fetch a client by ID with primary trainer details
 */
export async function GET({ params }) {
	const clientId = params.slug;

	const queryStr = `
        SELECT 
            clients.*, 
            users.id AS trainer_id, 
            users.firstname AS trainer_firstname, 
            users.lastname AS trainer_lastname,
            locations.name AS primary_location,
            lifecycle.gdpr_deleted_at,
            lifecycle.gdpr_delete_token,
            lifecycle.merged_into_client_id
        FROM clients
        LEFT JOIN users ON clients.primary_trainer_id = users.id
        LEFT JOIN locations ON clients.primary_location_id = locations.id
        LEFT JOIN gdpr_profile_lifecycle lifecycle
          ON lifecycle.profile_type = 'client'
         AND lifecycle.client_id = clients.id
        WHERE clients.id = $1
    `;

	try {
		const result = await query(queryStr, [clientId]);

		if (result.length === 0) {
			return json({ error: 'Client not found' }, { status: 404 });
		}

		return json(result[0]);
	} catch (error) {
		console.error('Error fetching client:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

export async function PUT({ request, params }) {
	const clientId = Number(params.slug);
	if (!Number.isInteger(clientId) || clientId <= 0) {
		return json({ error: 'Ogiltigt klient-id' }, { status: 400 });
	}

	try {
		await assertProfileNotGdprDeleted('client', clientId);

		const body = await request.json();
		const primaryTrainerId = body.primary_trainer_id ?? null;
		const primaryLocationId = body.primary_location_id ?? null;
		const isActive = body.active ?? true;

		const updateQuery = `
			UPDATE clients SET
				firstname = $1,
				lastname = $2,
				person_number = $3,
				email = $4,
				alternative_email = $5,
				phone = $6,
				primary_trainer_id = $7,
				primary_location_id = $8,
				active = $9,
				updated_at = NOW()
			WHERE id = $10
			RETURNING id
		`;

		const values = [
			body.firstname,
			body.lastname,
			body.person_number,
			body.email,
			body.alternative_email,
			body.phone,
			primaryTrainerId,
			primaryLocationId,
			isActive,
			clientId
		];

		const result = await query(updateQuery, values);

		if (result.length === 0) {
			return json({ error: 'Client not found or not updated' }, { status: 404 });
		}

		if (typeof body.password === 'string' && body.password.trim().length > 0) {
			const trimmedPassword = body.password.trim();
			if (!body.email) {
				return json(
					{ errors: { password: 'E-post krävs för att byta lösenord' } },
					{ status: 400 }
				);
			}
			if (trimmedPassword.length < 8) {
				return json(
					{ errors: { password: 'Lösenordet måste vara minst 8 tecken' } },
					{ status: 400 }
				);
			}
			await updateClientPassword(Number(clientId), body.email, trimmedPassword);
		}

		const refreshed = await query(
			`
			SELECT
				clients.*,
				users.id AS trainer_id,
				users.firstname AS trainer_firstname,
				users.lastname AS trainer_lastname,
				locations.name AS primary_location,
				lifecycle.gdpr_deleted_at,
				lifecycle.gdpr_delete_token,
				lifecycle.merged_into_client_id
			FROM clients
			LEFT JOIN users ON clients.primary_trainer_id = users.id
			LEFT JOIN locations ON clients.primary_location_id = locations.id
			LEFT JOIN gdpr_profile_lifecycle lifecycle
			  ON lifecycle.profile_type = 'client'
			 AND lifecycle.client_id = clients.id
			WHERE clients.id = $1
			`,
			[clientId]
		);

		return json(refreshed[0] ?? result[0]);
	} catch (error) {
		if (error instanceof ProfileLifecycleGuardError) {
			return json({ error: error.message, code: error.code }, { status: error.status });
		}

		console.error('Error updating client:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

export async function DELETE({ params, locals }) {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) {
		return json({ error: admin.message }, { status: admin.status });
	}

	const clientId = Number(params.slug);
	if (!Number.isFinite(clientId) || clientId <= 0) {
		return json({ error: 'Ogiltigt klient-id' }, { status: 400 });
	}

	try {
		const result = await withProfileLifecycleTransaction((client) =>
			deleteClientProfile({
				client,
				clientId,
				actorUserId: resolveLifecycleActorId(admin.authUser)
			})
		);

		return json(result);
	} catch (error) {
		if (error instanceof ProfileLifecycleError) {
			return json({ error: error.message, code: error.code }, { status: error.status });
		}

		console.error('Error deleting client profile:', error);
		return json({ error: 'Kunde inte ta bort klienten' }, { status: 500 });
	}
}
