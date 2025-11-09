import { lucia } from '$lib/server/lucia';

export async function POST({ locals, cookies }) {
        const session = locals.session;
        if (session) {
                await lucia.invalidateSession(session.id);
        }

        const blankSessionCookie = lucia.createBlankSessionCookie();
        cookies.set(blankSessionCookie.name, blankSessionCookie.value, blankSessionCookie.attributes);

        return new Response(null, { status: 204 });
}
