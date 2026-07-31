import { query } from '$lib/db';

export type GdprProfileType = 'client' | 'customer';

type ProfileConfig = {
	table: string;
	lifecycleColumn: string;
	singularLabel: string;
	pluralLabel: string;
	notFoundCode: string;
};

const profileConfigs: Record<GdprProfileType, ProfileConfig> = {
	client: {
		table: 'clients',
		lifecycleColumn: 'client_id',
		singularLabel: 'Klienten',
		pluralLabel: 'En eller flera klienter',
		notFoundCode: 'client_not_found'
	},
	customer: {
		table: 'customers',
		lifecycleColumn: 'customer_id',
		singularLabel: 'Kunden',
		pluralLabel: 'En eller flera kunder',
		notFoundCode: 'customer_not_found'
	}
};

export class ProfileLifecycleGuardError extends Error {
	status: number;
	code: string;

	constructor(status: number, message: string, code: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

function positiveUniqueIds(ids: number[]) {
	return Array.from(
		new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))
	);
}

export async function assertProfilesNotGdprDeleted(profileType: GdprProfileType, ids: number[]) {
	const config = profileConfigs[profileType];
	const uniqueIds = positiveUniqueIds(ids);
	if (!uniqueIds.length) return;

	const rows = await query<{ id: number; gdpr_deleted_at: string | null }>(
		`
		SELECT
			profile.id,
			lifecycle.gdpr_deleted_at
		FROM ${config.table} profile
		LEFT JOIN gdpr_profile_lifecycle lifecycle
		  ON lifecycle.profile_type = $1
		 AND lifecycle.${config.lifecycleColumn} = profile.id
		WHERE profile.id = ANY($2::int[])
		`,
		[profileType, uniqueIds]
	);

	if (rows.length !== uniqueIds.length) {
		throw new ProfileLifecycleGuardError(
			404,
			`${config.pluralLabel} hittades inte.`,
			config.notFoundCode
		);
	}

	if (rows.some((row) => row.gdpr_deleted_at)) {
		throw new ProfileLifecycleGuardError(
			409,
			`${config.pluralLabel} är GDPR-raderade och kan inte ändras.`,
			'profile_gdpr_deleted'
		);
	}
}

export async function assertProfileNotGdprDeleted(profileType: GdprProfileType, id: number) {
	const config = profileConfigs[profileType];
	const normalizedId = Number(id);
	if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
		throw new ProfileLifecycleGuardError(400, 'Ogiltigt profil-id.', 'invalid_profile_id');
	}

	try {
		await assertProfilesNotGdprDeleted(profileType, [normalizedId]);
	} catch (error) {
		if (error instanceof ProfileLifecycleGuardError && error.code === 'profile_gdpr_deleted') {
			throw new ProfileLifecycleGuardError(
				409,
				`${config.singularLabel} är GDPR-raderad och kan inte ändras.`,
				error.code
			);
		}
		if (error instanceof ProfileLifecycleGuardError && error.status === 404) {
			throw new ProfileLifecycleGuardError(
				404,
				`${config.singularLabel} hittades inte.`,
				error.code
			);
		}
		throw error;
	}
}

export async function assertPackageOwnerProfilesNotGdprDeleted({
	customerId,
	clientId
}: {
	customerId?: number | null;
	clientId?: number | null;
}) {
	if (customerId) {
		await assertProfileNotGdprDeleted('customer', customerId);
	}
	if (clientId) {
		await assertProfileNotGdprDeleted('client', clientId);
	}
}
