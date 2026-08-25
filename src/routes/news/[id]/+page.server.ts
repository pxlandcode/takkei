import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params }) => {
	const readRes = await fetch(`/api/news/${params.id}/read`, { method: 'PUT' });
	if (readRes.status === 404) {
		throw error(404, 'Nyheten hittades inte');
	}

	if (!readRes.ok) {
		throw error(readRes.status, 'Kunde inte hämta nyheten');
	}

	const news = await readRes.json();

	const latestRes = await fetch('/api/news?limit=10');
	const latest = latestRes.ok ? await latestRes.json() : [];
	const commentsRes = await fetch(`/api/news/${params.id}/comments`);
	const comments = commentsRes.ok ? await commentsRes.json() : [];

	return { news, latest, comments };
};
