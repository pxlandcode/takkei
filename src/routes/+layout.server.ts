import type { LayoutServerLoad } from './$types';
import { query } from '$lib/db';

export const load: LayoutServerLoad = async ({ locals }) => {
        const authUser = locals.user;

        if (!authUser) {
                return { user: null };
        }

        if (authUser.kind === 'trainer' && authUser.trainerId) {
                const trainerRows = await query(
                        `SELECT id, firstname, lastname, email, mobile, default_location_id, active, role, comment, created_at, updated_at, initials, key
                        FROM users
                        WHERE id = $1`,
                        [authUser.trainerId]
                );
                const trainer = trainerRows[0];
                if (!trainer) {
                        return { user: null };
                }

                const roles = await query(
                        `SELECT id, user_id, name, created_at, updated_at
                        FROM roles
                        WHERE user_id = $1`,
                        [trainer.id]
                );

                return {
                        user: {
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
                                account_id: authUser.id
                        }
                };
        }

        if (authUser.kind === 'client' && authUser.clientId) {
                const clientRows = await query(
                        `SELECT id, firstname, lastname, email, phone AS mobile, created_at, updated_at
                        FROM clients
                        WHERE id = $1`,
                        [authUser.clientId]
                );
                const client = clientRows[0];
                if (!client) {
                        return { user: null };
                }

                return {
                        user: {
                                kind: 'client' as const,
                                id: client.id,
                                firstname: client.firstname,
                                lastname: client.lastname,
                                email: client.email,
                                mobile: client.mobile,
                                created_at: client.created_at,
                                updated_at: client.updated_at,
                                roles: [],
                                account_id: authUser.id
                        }
                };
        }

        return { user: null };
};
