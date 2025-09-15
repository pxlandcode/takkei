import { query } from '$lib/db';

export async function GET({ params }) {
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
		const dt = new Date(r.start_time);
		const iso = dt.toISOString();
		const hour = iso.slice(11, 13); // 'HH'

		// saldojustering: no room and 03:xx
		const isSaldo = !r.room_id && hour === '03';

		return {
			id: r.id,
			datetime: iso.slice(0, 16).replace('T', ' '),
			date: iso.slice(0, 10),
			is_saldojustering: isSaldo,
			trainer_name: isSaldo
				? ''
				: [r.trainer_firstname, r.trainer_lastname].filter(Boolean).join(' '),
			client_name: [r.client_firstname, r.client_lastname].filter(Boolean).join(' ')
		};
	});

	return new Response(JSON.stringify(out), { status: 200 });
}
