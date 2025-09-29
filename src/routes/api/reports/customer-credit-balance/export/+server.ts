import { buildCustomerCreditWorkbook } from '$lib/services/api/reports/customerCreditBalance';

export const GET = async ({ url }) => {
	const start_date = url.searchParams.get('start_date');
	const end_date = url.searchParams.get('end_date');
	if (!start_date || !end_date) {
		return new Response('Missing start_date or end_date', { status: 400 });
	}

	const includeZero = url.searchParams.get('include_zero');
	const includeZeroBalances = includeZero ? /^(1|true|yes)$/i.test(includeZero) : false;

	const { buffer, filename } = await buildCustomerCreditWorkbook({
		startDate: start_date,
		endDate: end_date,
		includeZeroBalances
	});

	return new Response(buffer, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
