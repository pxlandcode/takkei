import { query } from '$lib/db';

function isAdministrator(user: any): boolean {
        if (!user) return false;
        const names: string[] = [];
        if (Array.isArray(user.roles)) {
                for (const role of user.roles) {
                        if (!role) continue;
                        const name = typeof role === 'string' ? role : role.name;
                        if (typeof name === 'string') {
                                names.push(name.toLowerCase());
                        }
                }
        }
        if (typeof user.role === 'string') {
                names.push(user.role.toLowerCase());
        }
        return names.includes('administrator');
}

export const GET = async ({ params, locals }) => {
        const authUser = locals.user;
        if (!authUser) {
                return new Response('Unauthorized', { status: 401 });
        }

        const idParam = params.id;
        const id = Number.parseInt(idParam, 10);
        if (!Number.isFinite(id)) {
                return new Response('Invalid id', { status: 400 });
        }

        const isAdmin = isAdministrator(authUser);
        const queryParams: any[] = [id];
        let whereClause = 'id = $1';

        if (!isAdmin) {
                if (typeof authUser.id !== 'number') {
                        return new Response('Forbidden', { status: 403 });
                }
                queryParams.push(authUser.id);
                whereClause += ` AND sender_user_id = $${queryParams.length}`;
        }

        try {
                const rows = await query(`SELECT * FROM mail_history WHERE ${whereClause}`, queryParams);
                const record = rows[0];
                if (!record) {
                        return new Response('Not Found', { status: 404 });
                }

                return new Response(JSON.stringify(record), {
                        headers: { 'content-type': 'application/json' }
                });
        } catch (error) {
                console.error('Failed to fetch mail history item', error);
                return new Response('Internal Server Error', { status: 500 });
        }
};
