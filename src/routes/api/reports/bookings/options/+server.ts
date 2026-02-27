import { json, type RequestHandler } from '@sveltejs/kit';
import { getBookingReportOptions } from '$lib/services/api/reports/bookings';

export const GET: RequestHandler = async () => {
	try {
		const options = await getBookingReportOptions();
		return json(options);
	} catch (error) {
		console.error('Failed to fetch booking report options', error);
		return json({ error: 'Failed to fetch booking report options' }, { status: 500 });
	}
};

