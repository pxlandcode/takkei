import { json } from '@sveltejs/kit';
import { getCustomerCreditReport } from '$lib/services/api/reports/customerCreditBalance';

export const GET = async ({ url }) => {
	const start_date = url.searchParams.get('start_date');
	const end_date = url.searchParams.get('end_date');
	if (!start_date || !end_date) return json({ error: 'Missing dates' }, { status: 400 });

	const includeZero = url.searchParams.get('include_zero');
	const includeZeroBalances = includeZero ? /^(1|true|yes)$/i.test(includeZero) : false;

	const report = await getCustomerCreditReport({
		startDate: start_date,
		endDate: end_date,
		includeZeroBalances
	});

	return json(report);
};
