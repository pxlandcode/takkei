import { getUserTargets } from '$lib/services/api/targetApiService';

export async function GET({ url }) {
	const userId = url.searchParams.get('userId');
	const date = url.searchParams.get('date');

	if (!userId || !date) {
		return new Response(JSON.stringify({ error: 'Missing required parameters' }), { status: 400 });
	}

	try {
		const targets = await getUserTargets(Number(userId), date);
		return new Response(JSON.stringify(targets), { status: 200 });
	} catch (error) {
		console.error('Error fetching targets:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
