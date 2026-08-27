import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import { query } from '$lib/db';
import { getSignupOnboardingCase, SignupOnboardingError } from '$lib/server/signupOnboarding';
import { error, redirect } from '@sveltejs/kit';

async function loadClientOptions() {
	try {
		return await query(
			`
			SELECT
				clients.id,
				clients.firstname,
				clients.lastname
			FROM clients
			LEFT JOIN gdpr_profile_lifecycle lifecycle
			  ON lifecycle.profile_type = 'client'
			 AND lifecycle.client_id = clients.id
			WHERE lifecycle.gdpr_deleted_at IS NULL
			  AND (
				TRIM(COALESCE(clients.firstname, '')) <> ''
				OR TRIM(COALESCE(clients.lastname, '')) <> ''
			  )
			ORDER BY clients.lastname ASC, clients.firstname ASC
			LIMIT 5000
			`
		);
	} catch (caught) {
		console.error('Failed to load onboarding client options:', caught);
		return [];
	}
}

async function loadCustomerOptions() {
	try {
		return await query(
			`
			SELECT
				customers.id,
				customers.name,
				customers.email,
				customers.phone,
				customers.customer_no,
				customers.organization_number,
				customers.invoice_address,
				customers.invoice_zip,
				customers.invoice_city,
				customers.invoice_reference
			FROM customers
			LEFT JOIN gdpr_profile_lifecycle lifecycle
			  ON lifecycle.profile_type = 'customer'
			 AND lifecycle.customer_id = customers.id
			WHERE lifecycle.gdpr_deleted_at IS NULL
			  AND NOT (
				TRIM(COALESCE(customers.name, '')) = ''
				AND TRIM(COALESCE(customers.email, '')) = ''
				AND TRIM(COALESCE(customers.organization_number, '')) = ''
			  )
			ORDER BY customers.name ASC
			LIMIT 5000
			`
		);
	} catch (caught) {
		console.error('Failed to load onboarding customer options:', caught);
		return [];
	}
}

async function loadTrainerOptions() {
	try {
		return await query(
			`
			SELECT id, firstname, lastname, default_location_id
			FROM users
			WHERE active = true
			ORDER BY firstname ASC, lastname ASC
			`
		);
	} catch (caught) {
		console.error('Failed to load onboarding trainer options:', caught);
		return [];
	}
}

async function loadLocationOptions() {
	try {
		return await query(
			`
			SELECT id, name
			FROM locations
			ORDER BY name ASC
			`
		);
	} catch (caught) {
		console.error('Failed to load onboarding location options:', caught);
		return [];
	}
}

export async function load({ locals, params }) {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) throw redirect(303, '/clients?view=mine');
	const caseId = Number(params.id);
	if (!Number.isInteger(caseId) || caseId <= 0) throw error(404, 'Registreringen hittades inte');

	try {
		const [workspace, clients, customers, trainers, locations] = await Promise.all([
			getSignupOnboardingCase(caseId),
			loadClientOptions(),
			loadCustomerOptions(),
			loadTrainerOptions(),
			loadLocationOptions()
		]);

		return { workspace, clients, customers, trainers, locations };
	} catch (caught) {
		if (caught instanceof SignupOnboardingError) throw error(caught.status, caught.message);
		throw caught;
	}
}
