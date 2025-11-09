import { json } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import { Argon2id } from 'oslo/password';
import crypto from 'crypto';
import { lucia, trainerUserId, trainerKeyId, clientUserId, clientKeyId } from '$lib/server/auth';
import { query } from '$lib/db.js';

type LoginKind = 'trainer' | 'client';

type KeyRow = {
        id: string;
        user_id: string;
        hashed_password: string | null;
        provider_id: string;
        provider_user_id: string;
        metadata: Record<string, any> | null;
};

type AuthUserRow = {
        id: string;
        email: string;
        kind: LoginKind;
        trainer_id: number | null;
        client_id: number | null;
};

const argon = new Argon2id();
const HASH_METADATA = { algo: 'argon2id', version: 1 };

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

const attempts = new Map<string, { count: number; first: number }>();

function getLimiterEntry(key: string) {
        const now = Date.now();
        const entry = attempts.get(key);
        if (!entry || now - entry.first > WINDOW_MS) {
                const fresh = { count: 0, first: now };
                attempts.set(key, fresh);
                return fresh;
        }
        return entry;
}

function isBlocked(key: string) {
        const entry = getLimiterEntry(key);
        return entry.count >= MAX_ATTEMPTS;
}

function registerFailure(key: string) {
        const entry = getLimiterEntry(key);
        entry.count += 1;
}

function resetFailures(key: string) {
        attempts.delete(key);
}

function encryptLegacyPassword(password: string, salt: string) {
        const hashInput = `--${salt}--${password}--`;
        return crypto.createHash('sha1').update(hashInput).digest('hex');
}

async function getKey(providerUserId: string) {
        const rows = await query(
                `SELECT id, user_id, hashed_password, provider_id, provider_user_id, metadata
                 FROM auth_key
                 WHERE provider_id = 'email' AND provider_user_id = $1`,
                [providerUserId]
        );
        return (rows[0] as KeyRow | undefined) ?? null;
}

async function getAuthUser(id: string) {
        const rows = await query(
                `SELECT id, email, kind, trainer_id, client_id
                 FROM auth_user
                 WHERE id = $1`,
                [id]
        );
        return (rows[0] as AuthUserRow | undefined) ?? null;
}

async function upsertAuthUser({
        id,
        email,
        kind,
        trainerId,
        clientId
}: {
        id: string;
        email: string;
        kind: LoginKind;
        trainerId: number | null;
        clientId: number | null;
}) {
        await query(
                `INSERT INTO auth_user (id, email, kind, trainer_id, client_id)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (id)
                 DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()`,
                [id, email, kind, trainerId, clientId]
        );
        return getAuthUser(id);
}

async function upsertKey({
        keyId,
        userId,
        providerUserId,
        password
}: {
        keyId: string;
        userId: string;
        providerUserId: string;
        password: string;
}) {
        const hashed = await argon.hash(password);
        await query(
                `INSERT INTO auth_key (id, user_id, hashed_password, provider_id, provider_user_id, metadata)
                 VALUES ($1, $2, $3, 'email', $4, $5::jsonb)
                 ON CONFLICT (provider_id, provider_user_id)
                 DO UPDATE SET hashed_password = EXCLUDED.hashed_password, user_id = EXCLUDED.user_id, metadata = EXCLUDED.metadata, created_at = NOW()`,
                [keyId, userId, hashed, providerUserId, JSON.stringify(HASH_METADATA)]
        );
        return getKey(providerUserId);
}

async function getTrainerAccount(trainer: any) {
        const luciaUserId = trainerUserId(trainer.id);
        const providerUserId = trainerKeyId(trainer.email);
        const key = await getKey(providerUserId);
        const authUser = key ? await getAuthUser(key.user_id) : await getAuthUser(luciaUserId);
        if (!key || !authUser) return null;
        return { authUser, key, providerUserId };
}

async function createTrainerAccount(trainer: any, password: string) {
        const luciaUserId = trainerUserId(trainer.id);
        const providerUserId = trainerKeyId(trainer.email);
        const authUser = await upsertAuthUser({
                id: luciaUserId,
                email: trainer.email,
                kind: 'trainer',
                trainerId: trainer.id,
                clientId: null
        });
        const key = await upsertKey({
                keyId: `email:${providerUserId}`,
                userId: authUser.id,
                providerUserId,
                password
        });
        return { authUser, key, providerUserId };
}

async function getClientAccount(client: any) {
        const luciaUserId = clientUserId(client.id);
        const providerUserId = clientKeyId(client.email);
        const key = await getKey(providerUserId);
        const authUser = key ? await getAuthUser(key.user_id) : await getAuthUser(luciaUserId);
        if (!key || !authUser) return null;
        return { authUser, key, providerUserId };
}

async function verifyPassword(key: KeyRow | null, password: string) {
        if (!key || !key.hashed_password) return false;
        const ok = await argon.verify(key.hashed_password, password);
        if (!ok) return false;
        const metadata =
                key.metadata && typeof key.metadata === 'object'
                        ? (key.metadata as Record<string, any>)
                        : {};
        if (metadata.version !== HASH_METADATA.version || metadata.algo !== HASH_METADATA.algo) {
                        const newHash = await argon.hash(password);
                        await query(`UPDATE auth_key SET hashed_password = $1, metadata = $2::jsonb WHERE id = $3`, [
                                newHash,
                                JSON.stringify(HASH_METADATA),
                                key.id
                        ]);
        }
        return true;
}

async function createSessionResponse(authUser: AuthUserRow, cookies: Cookies, rememberMe: boolean, payload: any) {
        const session = await lucia.createSession({ userId: authUser.id, attributes: {} });
        const sessionCookie = lucia.createSessionCookie(session.id);
        const cookieOptions = {
                ...sessionCookie.attributes,
                maxAge: rememberMe ? 60 * 60 * 24 : sessionCookie.attributes.maxAge,
                path: sessionCookie.attributes.path ?? '/',
                httpOnly: true
        };
        cookies.set(sessionCookie.name, sessionCookie.value, cookieOptions);
        return json(payload);
}

function sanitizeTrainer(trainer: any, authUser: AuthUserRow, roles: any[]) {
        return {
                ...trainer,
                roles,
                kind: 'trainer',
                lucia_user_id: authUser.id
        };
}

function sanitizeClient(client: any, authUser: AuthUserRow) {
        return {
                id: client.id,
                firstname: client.firstname,
                lastname: client.lastname,
                email: client.email,
                phone: client.phone ?? client.mobile ?? null,
                kind: 'client',
                lucia_user_id: authUser.id
        };
}

export async function POST(event) {
        const { request, cookies, getClientAddress } = event;
        const { email, password, rememberMe } = await request.json();

        if (!email || !password) {
                return json({ message: 'Email and password are required' }, { status: 400 });
        }

        const identifier = String(email).trim().toLowerCase();
        const limiterKey = `${getClientAddress ? getClientAddress() : 'unknown'}:${identifier}`;

        if (isBlocked(limiterKey)) {
                return json({ message: 'Too many login attempts. Try again later.' }, { status: 429 });
        }

        const trainerResult = await query('SELECT * FROM users WHERE LOWER(email) = $1', [identifier]);

        if (trainerResult.length > 0) {
                const trainer = trainerResult[0];
                const hashedPassword = encryptLegacyPassword(password, trainer.salt);

                let account = await getTrainerAccount(trainer);
                let valid = await verifyPassword(account?.key ?? null, password);

                if (!valid) {
                        if (hashedPassword !== trainer.crypted_password) {
                                registerFailure(limiterKey);
                                return json({ message: 'Invalid email or password' }, { status: 401 });
                        }

                        account = await createTrainerAccount(trainer, password);
                        valid = await verifyPassword(account.key, password);
                        if (!valid) {
                                registerFailure(limiterKey);
                                return json({ message: 'Invalid email or password' }, { status: 401 });
                        }
                }

                resetFailures(limiterKey);

                const roles = await query('SELECT * FROM roles WHERE user_id = $1', [trainer.id]);
                const trainerPayload = sanitizeTrainer(trainer, account.authUser, roles);
                return createSessionResponse(
                        account.authUser,
                        cookies,
                        Boolean(rememberMe),
                        { user: trainerPayload }
                );
        }

        const clientResult = await query('SELECT * FROM clients WHERE LOWER(email) = $1', [identifier]);
        if (!clientResult.length) {
                registerFailure(limiterKey);
                return json({ message: 'Invalid email or password' }, { status: 401 });
        }

        const client = clientResult[0];
        const account = await getClientAccount(client);
        if (!account) {
                registerFailure(limiterKey);
                return json({ message: 'Account unavailable. Please contact your trainer.' }, { status: 403 });
        }

        const valid = await verifyPassword(account.key, password);
        if (!valid) {
                registerFailure(limiterKey);
                return json({ message: 'Invalid email or password' }, { status: 401 });
        }

        resetFailures(limiterKey);
        const clientPayload = sanitizeClient(client, account.authUser);
        return createSessionResponse(account.authUser, cookies, Boolean(rememberMe), { user: clientPayload });
}
