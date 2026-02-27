import { json, type RequestHandler } from '@sveltejs/kit';
import { getNewClientsReportOptions } from '$lib/services/api/reports/newClients';

export const GET: RequestHandler = async () => {
	try {
		const options = await getNewClientsReportOptions();
		return json(options);
	} catch (error) {
		console.error('Failed to fetch new clients report options', error);
		return json({ error: 'Failed to fetch new clients report options' }, { status: 500 });
	}
};
