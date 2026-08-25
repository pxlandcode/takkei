import type { PageServerLoad } from './$types';

const filters = ['all', 'unread', 'pinned'] as const;

export const load: PageServerLoad = async ({ fetch, url }) => {
	const filterParam = url.searchParams.get('filter');
	const filter = filters.includes(filterParam as any)
		? (filterParam as (typeof filters)[number])
		: 'all';
	const listRes = await fetch(`/api/news?limit=20&filter=${filter}`);

	let news = [];
	if (listRes.ok) {
		news = await listRes.json();
	}

	return { news, filter };
};
