import { error, type PageServerLoad } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/news/${params.id}`);
	if (res.status === 404) {
		throw error(404, 'Nyheten hittades inte');
	}

	if (!res.ok) {
		throw error(res.status, 'Kunde inte hämta nyheten');
	}

	const news = await res.json();

	const latestRes = await fetch('/api/news?latest=1&limit=4');
	const latest = latestRes.ok ? await latestRes.json() : [];

	return { news, latest };
};
