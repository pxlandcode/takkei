import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, parent }) => {
        const authUser = locals.user;

        if (!authUser) {
                throw redirect(302, '/login');
        }

        if (authUser.kind !== 'client') {
                throw redirect(303, '/');
        }

        const parentData = await parent();

        return { ...parentData };
};
