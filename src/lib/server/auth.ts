import { Lucia, type Session, type User } from 'lucia';
import { NodePostgresAdapter } from '@lucia-auth/adapter-postgresql';
import { dev } from '$app/environment';
import { pool } from '$lib/db.js';

type LuciaKind = 'trainer' | 'client';

const adapter = new NodePostgresAdapter(pool, {
	user: 'auth_user',
	session: 'auth_session',
	key: 'auth_key'
});

export const lucia = new Lucia(
	adapter,
        {
                sessionCookie: {
                        attributes: {
                                secure: !dev,
                                sameSite: 'strict',
                                path: '/',
                                httpOnly: true
                        }
                },
                getUserAttributes: (attributes) => ({
                        email: attributes.email as string,
                        kind: attributes.kind as LuciaKind,
                        trainerId: attributes.trainer_id as number | null,
                        clientId: attributes.client_id as number | null
                })
        }
);

export type AuthSession = Session;
export type AuthUser = User;

export const trainerUserId = (trainerId: number) => `trainer:${trainerId}`;
export const clientUserId = (clientId: number) => `client:${clientId}`;
export const trainerKeyId = (email: string) => `trainer:${email.toLowerCase()}`;
export const clientKeyId = (email: string) => `client:${email.toLowerCase()}`;

declare module 'lucia' {
        interface Register {
                Lucia: typeof lucia;
                DatabaseUserAttributes: {
                        email: string;
                        kind: LuciaKind;
                        trainer_id: number | null;
                        client_id: number | null;
                };
        }
}
