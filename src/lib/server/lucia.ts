import { Lucia, TimeSpan } from 'lucia';
import { PostgresAdapter } from '@lucia-auth/adapter-postgresql';
import { pool } from '$lib/db';
import { randomUUID } from 'crypto';

type UserKind = 'trainer' | 'client';

export type DatabaseUserAttributes = {
        email: string;
        kind: UserKind;
        trainer_id: number | null;
        client_id: number | null;
        metadata: Record<string, unknown> | null;
};

const adapter = new PostgresAdapter(pool, {
        user: 'auth_accounts',
        session: 'auth_sessions'
});

export const lucia = new Lucia(adapter, {
        sessionExpiresIn: new TimeSpan(1, 'd'),
        sessionCookie: {
                attributes: {
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'strict',
                        path: '/',
                        httpOnly: true
                }
        },
        sessionIdGenerator: {
                generate: () => randomUUID()
        },
        getUserAttributes: (databaseUser: DatabaseUserAttributes) => ({
                kind: databaseUser.kind,
                trainerId: databaseUser.trainer_id,
                clientId: databaseUser.client_id,
                email: databaseUser.email,
                metadata: databaseUser.metadata ?? {}
        })
});

