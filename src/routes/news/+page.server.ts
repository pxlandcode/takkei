import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const listRes = await fetch('/api/news?limit=5');

	let news = [];
	if (listRes.ok) {
		news = await listRes.json();
	}

	return { news };
};
