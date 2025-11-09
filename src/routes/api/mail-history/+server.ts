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

export const GET = async ({ url, locals }) => {
	const authUser = locals.user;
	if (!authUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	const trainerId =
		authUser.kind === 'trainer'
			? authUser.trainerId ?? authUser.trainer_id ?? null
			: null;

	let resolvedRoles: Array<{ name?: string } | string> = [];
	if (trainerId) {
		try {
			resolvedRoles = await query('SELECT name FROM roles WHERE user_id = $1', [trainerId]);
		} catch (roleError) {
			console.warn('Failed to resolve user roles for mail history', roleError);
		}
	}

	const roleAwareUser = {
		...authUser,
		roles: resolvedRoles
	};

	const searchParams = url.searchParams;
	const limitParam = Number.parseInt(searchParams.get('limit') ?? '', 10);
	const offsetParam = Number.parseInt(searchParams.get('offset') ?? '', 10);
        const search = searchParams.get('search')?.trim() ?? '';
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');
        const senderIdParam = searchParams.get('senderId');
        const mineOnlyParam = searchParams.get('mineOnly');

	const isAdmin = isAdministrator(roleAwareUser);

	const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;
	const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : 0;

	let mineOnly = !isAdmin;
        if (mineOnlyParam === 'true') {
                mineOnly = true;
        } else if (mineOnlyParam === 'false' && isAdmin) {
                mineOnly = false;
        }

	const filters: string[] = [];
	const params: any[] = [];
	let paramIndex = 1;

	if (mineOnly || !isAdmin) {
		if (typeof trainerId !== 'number') {
			return new Response(JSON.stringify({ data: [], pagination: { total: 0, limit, offset } }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			});
		}
		filters.push(`sender_user_id = $${paramIndex++}`);
		params.push(trainerId);
	} else if (senderIdParam) {
		const senderId = Number.parseInt(senderIdParam, 10);
		if (Number.isFinite(senderId)) {
			filters.push(`sender_user_id = $${paramIndex++}`);
			params.push(senderId);
                }
        }

        if (startDateParam) {
                const startDate = new Date(startDateParam);
                if (!Number.isNaN(startDate.getTime())) {
                        filters.push(`sent_at >= $${paramIndex++}`);
                        params.push(startDate.toISOString());
                }
        }

        if (endDateParam) {
                const endDate = new Date(endDateParam);
                if (!Number.isNaN(endDate.getTime())) {
                        endDate.setUTCDate(endDate.getUTCDate() + 1);
                        filters.push(`sent_at < $${paramIndex++}`);
                        params.push(endDate.toISOString());
                }
        }

        if (search) {
                filters.push(`(
                        subject ILIKE $${paramIndex} OR
                        sender_name ILIKE $${paramIndex} OR
                        sender_email ILIKE $${paramIndex} OR
                        header ILIKE $${paramIndex} OR
                        subheader ILIKE $${paramIndex} OR
                        body_text ILIKE $${paramIndex} OR
                        recipients::text ILIKE $${paramIndex}
                )`);
                params.push(`%${search}%`);
                paramIndex++;
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

        try {
                        const baseQuery = `
                        SELECT
                                id,
                                sender_user_id,
                                sender_name,
                                sender_email,
                                recipients,
                                recipients_count,
                                subject,
                                header,
                                subheader,
                                sent_from,
                                sent_at,
                                status,
                                error,
                                LEFT(COALESCE(body_text, ''), 200) AS body_text_preview
                        FROM mail_history
                        ${whereClause}
                        ORDER BY sent_at DESC
                        LIMIT $${paramIndex++}
                        OFFSET $${paramIndex++}
                `;

                const data = await query(baseQuery, [...params, limit, offset]);

                const [{ count = 0 } = {}] = await query(
                        `SELECT COUNT(*)::int AS count FROM mail_history ${whereClause}`,
                        params
                );

                const responseBody = {
                        data,
                        pagination: {
                                total: Number(count) || 0,
                                limit,
                                offset,
                                hasMore: offset + data.length < Number(count || 0)
                        }
                };

                return new Response(JSON.stringify(responseBody), {
                        headers: { 'content-type': 'application/json' }
                });
        } catch (error) {
                console.error('Failed to fetch mail history', error);
                return new Response('Internal Server Error', { status: 500 });
        }
};
