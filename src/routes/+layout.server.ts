import { query } from '$lib/db';
import { redirect } from '@sveltejs/kit';

export async function load({ cookies, url }) {
	const userId = cookies.get('session');
	const currentRoute = url.pathname;

	// Public routes that skip auth
	const publicRoutes = ['/login', '/register'];
	if (publicRoutes.includes(currentRoute)) return {};

	// If not logged in, redirect
	if (!userId) throw redirect(302, '/login');

	// Full user query
	const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
	const user = userResult[0];

	if (!user) throw redirect(302, '/login');

	// Fetch roles
	const roles = await query('SELECT * FROM roles WHERE user_id = $1', [userId]);
	user.roles = roles;

	// ✅ Return full user
	return { user };
}
