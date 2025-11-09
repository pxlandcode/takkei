import { query } from '$lib/db.js';
import { redirect } from '@sveltejs/kit';

export async function load({ locals, url }) {
        const currentRoute = url.pathname;
        const publicRoutes = ['/login'];

        if (publicRoutes.includes(currentRoute)) {
                return { user: null };
        }

        const authUser = locals.user;

        if (!authUser) {
                throw redirect(302, '/login');
        }

        if (authUser.kind === 'trainer') {
                const trainerId = authUser.trainerId ?? authUser.trainer_id;
                if (!trainerId) throw redirect(302, '/login');

                const trainerResult = await query('SELECT * FROM users WHERE id = $1', [trainerId]);
                const trainer = trainerResult[0];
                if (!trainer) throw redirect(302, '/login');

                const roles = await query('SELECT * FROM roles WHERE user_id = $1', [trainerId]);
                trainer.roles = roles;
                trainer.kind = 'trainer';
                trainer.lucia_user_id = authUser.id;

                return { user: trainer };
        }

        if (authUser.kind === 'client') {
                const clientId = authUser.clientId ?? authUser.client_id;
                if (!clientId) throw redirect(302, '/login');

                const clientResult = await query(
                        'SELECT id, firstname, lastname, email, phone, mobile FROM clients WHERE id = $1',
                        [clientId]
                );
                const client = clientResult[0];
                if (!client) throw redirect(302, '/login');

                return {
                        user: {
                                id: client.id,
                                firstname: client.firstname,
                                lastname: client.lastname,
                                email: client.email,
                                phone: client.phone ?? client.mobile ?? null,
                                kind: 'client',
                                lucia_user_id: authUser.id
                        }
                };
        }

        return { user: null };
}
