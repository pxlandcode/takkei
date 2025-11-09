import { json } from '@sveltejs/kit';
import { Argon2id } from 'oslo/password';
import { query } from '$lib/db.js';
import { clientKeyId } from '$lib/server/auth';

const argon = new Argon2id();
const HASH_METADATA = { algo: 'argon2id', version: 1 };

export const POST = async ({ locals, request }) => {
	const authUser = locals.user;

	if (!authUser || authUser.kind !== 'client') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { currentPassword, newPassword, confirmPassword } = await request.json();
	const errors: Record<string, string> = {};

	if (!currentPassword) errors.currentPassword = 'Ange nuvarande lösenord';
	if (!newPassword) errors.newPassword = 'Ange nytt lösenord';
	if (newPassword && newPassword.length < 8)
		errors.newPassword = 'Lösenordet måste vara minst 8 tecken';
	if (newPassword !== confirmPassword)
		errors.confirmPassword = 'Lösenorden matchar inte';

	if (Object.keys(errors).length > 0) {
		return json({ errors }, { status: 400 });
	}

	const providerUserId = clientKeyId(authUser.email);
	const keyRows = await query(
		`SELECT id, hashed_password FROM auth_key WHERE provider_id = 'email' AND provider_user_id = $1 LIMIT 1`,
		[providerUserId]
	);

	if (keyRows.length === 0 || !keyRows[0].hashed_password) {
		return json({ errors: { general: 'Konto saknas för användaren' } }, { status: 404 });
	}

	const key = keyRows[0];
	const isValid = await argon.verify(key.hashed_password, currentPassword);

	if (!isValid) {
		return json({ errors: { currentPassword: 'Fel nuvarande lösenord' } }, { status: 400 });
	}

	const newHash = await argon.hash(newPassword);

	await query(`UPDATE auth_key SET hashed_password = $1, metadata = $2::jsonb WHERE id = $3`, [
		newHash,
		JSON.stringify(HASH_METADATA),
		key.id
	]);

	return json({ success: true });
};
