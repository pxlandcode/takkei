import { query } from '$lib/db';
import type { PageServerLoad } from './$types';

export type SignupPackage = {
	id: number;
	name: string;
	price: number | string;
	price_with_vat: number | string;
	sessions: number | null;
	validity_start_date: string | null;
	validity_end_date: string | null;
};

export const load: PageServerLoad = async () => {
	try {
		const packages = await query<SignupPackage>(`
			SELECT id, name, price, price * 1.06 AS price_with_vat, sessions, validity_start_date, validity_end_date
			FROM articles
			WHERE active = true
				AND (name LIKE '12 träningar%' OR name LIKE '24 träningar%' OR name LIKE '48 träningar%')
			ORDER BY name ASC
		`);

		return { packages };
	} catch (err) {
		console.error('Error fetching signup training packages:', err);
		return { packages: [] };
	}
};
