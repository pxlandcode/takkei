import { lucia } from '$lib/server/auth';

export async function POST({ cookies, locals }) {
        if (locals.session) {
                await lucia.invalidateSession(locals.session.id);
        }
        const blank = lucia.createBlankSessionCookie();
        cookies.set(blank.name, blank.value, {
                ...blank.attributes,
                path: blank.attributes.path ?? '/',
                httpOnly: true
        });
        locals.session = null;
        locals.user = null;
        return new Response(null, { status: 204 });
}
