import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/news/${params.id}`);
	if (res.status === 404) {
		throw error(404, 'Nyheten hittades inte');
	}

	if (!res.ok) {
		throw error(res.status, 'Kunde inte hämta nyheten');
	}

	const news = await res.json();
	return { news };
};
