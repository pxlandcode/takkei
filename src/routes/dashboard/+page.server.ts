import { query } from '$lib/db.js';
import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
        if (!locals.user) {
                throw redirect(302, '/login');
        }

        if (locals.user.kind !== 'trainer') {
                throw redirect(302, '/client');
        }

        const trainerId = locals.user.trainerId ?? locals.user.trainer_id ?? locals.user.id;
        const result = await query(
                'SELECT id, firstname, lastname, email, role FROM users WHERE id = $1',
                [trainerId]
        );
        const user = result[0];

        if (!user) {
                throw redirect(302, '/login');
        }

        return { user };
}
