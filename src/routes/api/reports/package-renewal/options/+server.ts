import { json, type RequestHandler } from '@sveltejs/kit';
import { getPackageRenewalOptions } from '$lib/services/api/reports/packageRenewal';

export const GET: RequestHandler = async () => {
	try {
		const options = await getPackageRenewalOptions();
		return json(options);
	} catch (error) {
		console.error('Failed to fetch package renewal report options', error);
		return json({ error: 'Failed to fetch package renewal report options' }, { status: 500 });
	}
};
