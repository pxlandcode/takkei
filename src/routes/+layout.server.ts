import { query } from '$lib/db';
import { redirect } from '@sveltejs/kit';

export async function load({ cookies, url }) {
	const userId = cookies.get('session');
	const currentRoute = url.pathname;

	// Exclude specific routes from requiring authentication
	const publicRoutes = ['/login', '/register']; // Add any public routes here
	if (publicRoutes.includes(currentRoute)) {
		return {}; // Skip user loading for public routes
	}

	// Redirect to login if no session exists
	if (!userId) {
		throw redirect(302, '/login');
	}

	// Fetch user data
	const result = await query(
		'SELECT id, firstname, lastname, email, role FROM users WHERE id = $1',
		[userId]
	);
	const user = result[0];

	// If no user is found in the database, redirect to login
	if (!user) {
		throw redirect(302, '/login');
	}

	// Pass user data to the client
	return { user };
}
