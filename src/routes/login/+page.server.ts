import { redirect } from '@sveltejs/kit';

export function load({ locals }) {
        if (!locals.user) {
                return {};
        }

        if (locals.user.kind === 'client') {
                throw redirect(302, '/client');
        }

        throw redirect(302, '/');
}
