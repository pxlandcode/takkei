import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import { lucia } from '$lib/server/lucia';
import { Argon2id } from 'oslo/password';
import { TimeSpan } from 'lucia';
import { consumeAttempt, resetAttempts } from '$lib/server/rate-limit';
import crypto from 'crypto';

const PASSWORD_HASHER = new Argon2id();

function encryptLegacyPassword(password: string, salt: string) {
        const hashInput = `--${salt}--${password}--`;
        return crypto.createHash('sha1').update(hashInput).digest('hex');
}

function normalizeEmail(email: string) {
        return email.trim().toLowerCase();
}

type LoginPayload = {
        email?: string;
        password?: string;
        rememberMe?: boolean;
};

export async function POST({ request, cookies, getClientAddress }) {
        const body: LoginPayload = await request.json();
        const email = body.email ? normalizeEmail(body.email) : '';
        const password = body.password?.trim() ?? '';
        const rememberMe = Boolean(body.rememberMe);

        if (!email || !password) {
                        return json({ message: 'Email and password are required' }, { status: 400 });
        }

        const ipKey = `ip:${getClientAddress()}`;
        const emailKey = `email:${email}`;

        const ipAttempt = consumeAttempt(ipKey);
        if (!ipAttempt.allowed) {
                return json(
                        { message: 'Too many login attempts. Please try again later.' },
                        { status: 429, headers: { 'retry-after': String(ipAttempt.retryAfter) } }
                );
        }

        const emailAttempt = consumeAttempt(emailKey);
        if (!emailAttempt.allowed) {
                return json(
                        { message: 'Too many login attempts for this account. Please try again later.' },
                        { status: 429, headers: { 'retry-after': String(emailAttempt.retryAfter) } }
                );
        }

        try {
                const accountRows = await query(
                        `SELECT id, email, hashed_password, kind, trainer_id, client_id, metadata
                        FROM auth_accounts
                        WHERE email = $1`,
                        [email]
                );

                let account = accountRows[0] as
                        | (typeof accountRows[0] & {
                                  hashed_password: string;
                                  kind: 'trainer' | 'client';
                                  trainer_id: number | null;
                                  client_id: number | null;
                                  metadata: Record<string, unknown> | null;
                          })
                        | undefined;

                let trainer: any = null;
                let client: any = null;

                if (account) {
                        const verified = await PASSWORD_HASHER.verify(account.hashed_password, password);
                        if (!verified) {
                                return json({ message: 'Invalid email or password' }, { status: 401 });
                        }

                        if (PASSWORD_HASHER.needsRehash(account.hashed_password)) {
                                const newHash = await PASSWORD_HASHER.hash(password);
                                await query(`UPDATE auth_accounts SET hashed_password = $1, updated_at = NOW() WHERE id = $2`, [
                                        newHash,
                                        account.id
                                ]);
                                account.hashed_password = newHash;
                        }

                        if (account.kind === 'trainer' && account.trainer_id) {
                                const trainerRows = await query(
                                        `SELECT id, firstname, lastname, email, mobile, default_location_id, active, role, comment, created_at, updated_at, initials, key
                                        FROM users
                                        WHERE id = $1`,
                                        [account.trainer_id]
                                );
                                trainer = trainerRows[0];
                                if (!trainer) {
                                        return json({ message: 'Account is misconfigured' }, { status: 500 });
                                }
                        } else if (account.kind === 'client' && account.client_id) {
                                const clientRows = await query(
                                        `SELECT id, firstname, lastname, email, phone AS mobile, created_at, updated_at
                                        FROM clients
                                        WHERE id = $1`,
                                        [account.client_id]
                                );
                                client = clientRows[0];
                                if (!client) {
                                        return json({ message: 'Account is misconfigured' }, { status: 500 });
                                }
                        } else {
                                return json({ message: 'Account is misconfigured' }, { status: 500 });
                        }
                } else {
                        const trainerRows = await query(
                                `SELECT id, firstname, lastname, email, mobile, default_location_id, active, role, comment, created_at, updated_at, initials, key, salt, crypted_password
                                FROM users
                                WHERE email = $1`,
                                [email]
                        );
                        const legacyTrainer = trainerRows[0];

                        if (!legacyTrainer) {
                                return json({ message: 'Invalid email or password' }, { status: 401 });
                        }

                        const legacyHash = encryptLegacyPassword(password, legacyTrainer.salt);
                        if (legacyHash !== legacyTrainer.crypted_password) {
                                return json({ message: 'Invalid email or password' }, { status: 401 });
                        }

                        const hashedPassword = await PASSWORD_HASHER.hash(password);
                        const insertedAccount = await query(
                                `INSERT INTO auth_accounts (email, hashed_password, kind, trainer_id, metadata, created_at, updated_at)
                                VALUES ($1, $2, 'trainer', $3, '{}'::jsonb, NOW(), NOW())
                                RETURNING id, email, kind, trainer_id, client_id, metadata`,
                                [email, hashedPassword, legacyTrainer.id]
                        );

                        account = insertedAccount[0];
                        trainer = legacyTrainer;
                }

                if (!account) {
                        return json({ message: 'Authentication failed' }, { status: 500 });
                }

                const session = await lucia.createSession(account.id, {}, {
                        expiresIn: rememberMe ? new TimeSpan(1, 'd') : new TimeSpan(30, 'm')
                });
                const sessionCookie = lucia.createSessionCookie(session.id);
                cookies.set(sessionCookie.name, sessionCookie.value, {
                        ...sessionCookie.attributes,
                        maxAge: rememberMe ? 60 * 60 * 24 : 60 * 30
                });

                let responseUser;
                if (account.kind === 'trainer') {
                        const roles = await query(`SELECT id, user_id, name, created_at, updated_at FROM roles WHERE user_id = $1`, [
                                trainer.id
                        ]);

                        responseUser = {
                                kind: 'trainer' as const,
                                id: trainer.id,
                                firstname: trainer.firstname,
                                lastname: trainer.lastname,
                                email: trainer.email,
                                mobile: trainer.mobile,
                                default_location_id: trainer.default_location_id,
                                active: trainer.active,
                                role: trainer.role,
                                comment: trainer.comment,
                                created_at: trainer.created_at,
                                updated_at: trainer.updated_at,
                                initials: trainer.initials,
                                key: trainer.key,
                                roles,
                                account_id: account.id
                        };
                } else {
                        responseUser = {
                                kind: 'client' as const,
                                id: client.id,
                                firstname: client.firstname,
                                lastname: client.lastname,
                                email: client.email,
                                mobile: client.mobile,
                                created_at: client.created_at,
                                updated_at: client.updated_at,
                                roles: [],
                                account_id: account.id
                        };
                }

                resetAttempts(ipKey);
                resetAttempts(emailKey);

                return json({ user: responseUser });
        } catch (err) {
                console.error('Login error', err);
                return json({ message: 'Unable to login right now' }, { status: 500 });
        }
}
