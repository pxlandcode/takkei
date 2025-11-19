import { getUserTargets } from '$lib/services/api/targetApiService';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	const ownerType = (url.searchParams.get('ownerType') as 'trainer' | 'location') ?? 'trainer';
	const ownerIdRaw = url.searchParams.get('ownerId');
	const date = url.searchParams.get('date');

	const ownerId = ownerIdRaw ? Number(ownerIdRaw) : NaN;

	if (!ownerIdRaw || !date || Number.isNaN(ownerId)) {
		console.warn('Missing required parameters', { ownerType, ownerIdRaw, date });
		return new Response(JSON.stringify({ error: 'Missing required parameters' }), { status: 400 });
	}

	try {
		const targets = await getUserTargets(ownerId, date);

		return new Response(JSON.stringify(targets), { status: 200 });
	} catch (error) {
		console.error('❌ Error fetching targets:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
};
