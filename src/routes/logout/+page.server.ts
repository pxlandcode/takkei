import { redirect } from '@sveltejs/kit';

export const load = async ({ fetch }) => {
	await fetch('/api/logout', { method: 'POST' });
	throw redirect(302, '/login');
};
