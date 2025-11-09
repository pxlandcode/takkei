import type { Handle } from '@sveltejs/kit';
import { json, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { handleRequest } from '@lucia-auth/sveltekit';
import { lucia } from '$lib/server/lucia';
import { i18n } from '$lib/i18n';

const handleLucia = handleRequest(lucia);

const PUBLIC_PAGE_ROUTES = ['/login', '/register'];
const PUBLIC_API_ROUTES = ['/api/login'];

const authorizationGuard: Handle = async ({ event, resolve }) => {
        const path = event.url.pathname;

        if (
                path.startsWith('/_') ||
                path.startsWith('/favicon') ||
                path.startsWith('/images') ||
                path === '/service-worker.js'
        ) {
                return resolve(event);
        }

        if (path.startsWith('/api')) {
                if (!PUBLIC_API_ROUTES.includes(path)) {
                        const user = event.locals.user;
                        if (!user) {
                                return json({ message: 'Unauthorized' }, { status: 401 });
                        }

                        if (path.startsWith('/api/client')) {
                                if (user.kind !== 'client') {
                                        return json({ message: 'Forbidden' }, { status: 403 });
                                }
                        } else if (user.kind !== 'trainer') {
                                return json({ message: 'Forbidden' }, { status: 403 });
                        }
                }
                return resolve(event);
        }

        const matchesPublicPage = PUBLIC_PAGE_ROUTES.some((route) =>
                path === route || path.startsWith(`${route}/`)
        );

        if (matchesPublicPage) {
                const user = event.locals.user;
                if (user && path === '/login') {
                        throw redirect(303, user.kind === 'client' ? '/client' : '/');
                }
                return resolve(event);
        }

        const user = event.locals.user;

        if (!user) {
                throw redirect(303, '/login');
        }

        if (path.startsWith('/client')) {
                if (user.kind !== 'client') {
                        throw redirect(303, '/');
                }
        } else if (user.kind !== 'trainer') {
                throw redirect(303, '/client');
        }

        return resolve(event);
};

const handleParaglide: Handle = i18n.handle();

export const handle: Handle = sequence(handleLucia, authorizationGuard, handleParaglide);
