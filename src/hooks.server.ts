import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';
import { i18n } from '$lib/i18n';
import { lucia } from '$lib/server/auth';

const PUBLIC_PATHS = new Set(['/login', '/api/login', '/api/signup']);

const handleAuth: Handle = async ({ event, resolve }) => {
        const { pathname } = event.url;

        if (event.request.method === 'OPTIONS') {
                return resolve(event);
        }

        if (
                pathname.startsWith('/images') ||
                pathname.startsWith('/static') ||
                pathname.startsWith('/build') ||
                pathname.startsWith('/_app') ||
                pathname.startsWith('/favicon') ||
                pathname.startsWith('/service-worker')
        ) {
                return resolve(event);
        }

        const authRequest = lucia.handleRequest(event);
        event.locals.auth = authRequest;

        const validated = await authRequest.validate();
        event.locals.session = validated?.session ?? null;
        event.locals.user = validated?.user ?? null;

        const isPublic = PUBLIC_PATHS.has(pathname);
        if (isPublic) {
                return resolve(event);
        }

        if (!event.locals.user) {
                if (pathname.startsWith('/api/')) {
                        return new Response(JSON.stringify({ message: 'Unauthorized' }), {
                                status: 401,
                                headers: { 'Content-Type': 'application/json' }
                        });
                }
                throw redirect(302, '/login');
        }

        const kind = event.locals.user.kind;
        const isClientArea = pathname === '/client' || pathname.startsWith('/client/');
        const isClientApi = pathname.startsWith('/api/client');

        if ((isClientArea || isClientApi) && kind !== 'client') {
                if (pathname.startsWith('/api/')) {
                        return new Response(JSON.stringify({ message: 'Forbidden' }), {
                                status: 403,
                                headers: { 'Content-Type': 'application/json' }
                        });
                }
                throw redirect(303, '/');
        }

        const isTrainerArea = !isClientArea && !isClientApi;
        if (isTrainerArea && kind !== 'trainer') {
                if (pathname.startsWith('/api/')) {
                        return new Response(JSON.stringify({ message: 'Forbidden' }), {
                                status: 403,
                                headers: { 'Content-Type': 'application/json' }
                        });
                }
                throw redirect(303, '/client');
        }

        return resolve(event);
};

const handleParaglide: Handle = i18n.handle();

export const handle: Handle = sequence(handleAuth, handleParaglide);
