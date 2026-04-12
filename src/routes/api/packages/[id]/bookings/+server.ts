import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { getStockholmYmd, isSaldoAdjustmentBooking } from '$lib/server/packageSemantics';

export const GET: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (Number.isNaN(id)) {
		return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400 });
	}

	const rows = await query(
		`SELECT
       b.id,
       b.start_time,
       b.room_id,
       u.firstname AS trainer_firstname,
       u.lastname  AS trainer_lastname,
       c.id        AS client_id,
       c.firstname AS client_firstname,
       c.lastname  AS client_lastname
     FROM bookings b
     LEFT JOIN users   u ON u.id = b.trainer_id
     LEFT JOIN clients c ON c.id = b.client_id
     WHERE b.package_id = $1
     ORDER BY b.start_time DESC`,
		[id]
	);

	const out = rows.map((r: any) => {
		const dt = r.start_time ? new Date(r.start_time) : null;
		const iso = dt && !Number.isNaN(dt.getTime()) ? dt.toISOString() : null;
		const isSaldo = isSaldoAdjustmentBooking({
			room_id: r.room_id,
			start_time: r.start_time
		});

		return {
			id: r.id,
			datetime: iso,
			date: getStockholmYmd(r.start_time) ?? iso?.slice(0, 10) ?? '',
			is_saldojustering: isSaldo,
			trainer_name: isSaldo
				? ''
				: [r.trainer_firstname, r.trainer_lastname].filter(Boolean).join(' '),
			client_name: [r.client_firstname, r.client_lastname].filter(Boolean).join(' ')
		};
	});

	return new Response(JSON.stringify(out), { status: 200 });
};
