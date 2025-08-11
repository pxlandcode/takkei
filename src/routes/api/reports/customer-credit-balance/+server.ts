import { json } from '@sveltejs/kit';
import { getCustomerCreditRows } from '$lib/services/api/reports/customerCreditBalance';

export const GET = async ({ url }) => {
	const start_date = url.searchParams.get('start_date');
	const end_date = url.searchParams.get('end_date');
	if (!start_date || !end_date) return json({ error: 'Missing dates' }, { status: 400 });

	const rows = await getCustomerCreditRows(start_date, end_date);
	return json({ rows });
};
