import { json, type RequestHandler } from '@sveltejs/kit';
import { getClientReportOptions } from '$lib/services/api/reports/clientSummary';

export const GET: RequestHandler = async () => {
	try {
		const options = await getClientReportOptions();
		return json(options);
	} catch (error) {
		console.error('Failed to fetch client report options', error);
		return json({ error: 'Failed to fetch client report options' }, { status: 500 });
	}
};
