import type { Session, User } from 'lucia';
import type { DatabaseUserAttributes } from '$lib/server/lucia';

declare global {
        namespace App {
                interface Locals {
                        user: User | null;
                        session: Session | null;
                }
                interface PageData {
                        user: import('$lib/types/userTypes').User | null;
                }
        }
}

declare module 'lucia' {
        interface Register {
                Lucia: typeof import('$lib/server/lucia').lucia;
                DatabaseUserAttributes: DatabaseUserAttributes;
        }
}

export {};
