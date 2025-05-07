import { query } from '$lib/db';
import crypto from 'crypto';

function encryptPassword(password, salt) {
	const hashInput = `--${salt}--${password}--`;
	return crypto.createHash('sha1').update(hashInput).digest('hex');
}

export async function POST({ request, cookies }) {
	const { email, password } = await request.json();

	// Get user
	const result = await query('SELECT * FROM users WHERE email = $1', [email]);
	const user = result[0];

	if (!user) {
		return new Response(JSON.stringify({ message: 'Invalid email or password' }), { status: 401 });
	}

	// Check password
	const hashedPassword = encryptPassword(password, user.salt);
	if (hashedPassword !== user.crypted_password) {
		return new Response(JSON.stringify({ message: 'Invalid email or password' }), { status: 401 });
	}

	// ✅ Fetch roles
	const roles = await query('SELECT * FROM roles WHERE user_id = $1', [user.id]);
	user.roles = roles;

	// Set session cookie
	cookies.set('session', user.id, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
		path: '/',
		maxAge: 60 * 30
	});

	return new Response(JSON.stringify({ user }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}
