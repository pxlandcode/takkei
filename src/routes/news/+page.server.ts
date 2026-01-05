import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const [listRes, latestRes] = await Promise.all([
		fetch('/api/news?limit=20'),
		fetch('/api/news?latest=1&limit=4')
	]);

	let news = [];
	let latest = [];
	if (listRes.ok) {
		news = await listRes.json();
	}
	if (latestRes.ok) {
		latest = await latestRes.json();
	}

	return { news, latest };
};
