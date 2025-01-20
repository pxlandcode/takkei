import { query } from '$lib/db';
import { redirect } from '@sveltejs/kit';

export async function load({ cookies }) {
	const userId = cookies.get('session');

	if (!userId) {
		throw redirect(302, '/login');
	}

	// Fetch user details
	const result = await query(
		'SELECT id, firstname, lastname, email, role FROM users WHERE id = $1',
		[userId]
	);
	const user = result[0];

	if (!user) {
		throw redirect(302, '/login');
	}

	// Return the user data
	return { user };
}
