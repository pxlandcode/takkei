import type { lucia, AuthSession, AuthUser } from '$lib/server/auth';

type LocalsAuthRequest = ReturnType<typeof lucia.handleRequest>;
type LocalsUser = (AuthUser & {
        kind: 'trainer' | 'client';
        trainerId: number | null;
        clientId: number | null;
}) | null;

declare global {
        namespace App {
                // interface Error {}
                interface Locals {
                        auth: LocalsAuthRequest;
                        session: AuthSession | null;
                        user: LocalsUser;
                }
                interface PageData {
                        user: LocalsUser;
                }
                // interface PageState {}
                // interface Platform {}
        }
}

export {};
