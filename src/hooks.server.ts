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

	const sessionId = event.cookies.get(lucia.sessionCookieName) ?? null;
	type ValidationResult = Awaited<ReturnType<typeof lucia.validateSession>>;
	let session: ValidationResult['session'] | null = null;
	let user: ValidationResult['user'] | null = null;

	if (sessionId) {
		try {
			const result = await lucia.validateSession(sessionId);
			session = result.session;
			user = result.user;

			if (session?.fresh) {
				const sessionCookie = lucia.createSessionCookie(session.id);
				event.cookies.set(sessionCookie.name, sessionCookie.value, {
					path: sessionCookie.attributes.path ?? '/',
					domain: sessionCookie.attributes.domain,
					httpOnly: sessionCookie.attributes.httpOnly,
					sameSite: sessionCookie.attributes.sameSite,
					secure: sessionCookie.attributes.secure,
					maxAge: sessionCookie.attributes.maxAge
				});
			}

			if (!session) {
				const blankCookie = lucia.createBlankSessionCookie();
				event.cookies.set(blankCookie.name, blankCookie.value, {
					path: blankCookie.attributes.path ?? '/',
					domain: blankCookie.attributes.domain,
					httpOnly: blankCookie.attributes.httpOnly,
					sameSite: blankCookie.attributes.sameSite,
					secure: blankCookie.attributes.secure,
					maxAge: blankCookie.attributes.maxAge
				});
			}
		} catch {
			const blankCookie = lucia.createBlankSessionCookie();
			event.cookies.set(blankCookie.name, blankCookie.value, {
				path: blankCookie.attributes.path ?? '/',
				domain: blankCookie.attributes.domain,
				httpOnly: blankCookie.attributes.httpOnly,
				sameSite: blankCookie.attributes.sameSite,
				secure: blankCookie.attributes.secure,
				maxAge: blankCookie.attributes.maxAge
			});
		}
	}

	event.locals.session = session;
	event.locals.user = user;

        const isPublic = PUBLIC_PATHS.has(pathname);
        if (isPublic) {
                return resolve(event);
        }

if (!event.locals.user) {
		if (pathname.startsWith('/api/')) {
			console.warn('[handleAuth] Unauthorized request', {
				path: pathname,
				method: event.request.method
			});
			return new Response(JSON.stringify({ message: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		throw redirect(302, '/login');
	}

        const kind = event.locals.user.kind;
	const isClientArea = pathname === '/client' || pathname.startsWith('/client/');
	const isClientApi =
		pathname === '/api/client' ||
		pathname.startsWith('/api/client/') ||
		pathname.startsWith('/api/client?');

	if ((isClientArea || isClientApi) && kind !== 'client') {
		if (pathname.startsWith('/api/')) {
			console.warn('[handleAuth] Forbidden client route', {
				path: pathname,
				kind
			});
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
			console.warn('[handleAuth] Forbidden trainer route', {
				path: pathname,
				kind
			});
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
