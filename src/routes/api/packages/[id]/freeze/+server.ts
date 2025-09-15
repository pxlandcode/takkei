import { query } from '$lib/db';

// Reuse the tiny YAML-ish parser to read installments
function parseInstallments(text: string | null | undefined) {
	if (!text) return [] as { date: string; sum: number; invoice_no?: string }[];
	const rx =
		/['"]?(\d{4}-\d{2}-\d{2})['"]?\s*:\s*\n(?:.*\n)*?\s*:sum:\s*([0-9.,]+)(?:\s*\n\s*:invoice_no:\s*['"]?([^'"]*)['"]?)?/g;
	const out: { date: string; sum: number; invoice_no?: string }[] = [];
	let m: RegExpExecArray | null;
	while ((m = rx.exec(text))) {
		const [, date, sumStr, invoiceNo] = m;
		out.push({ date, sum: parseFloat(sumStr.replace(',', '.')) || 0, invoice_no: invoiceNo ?? '' });
	}
	out.sort((a, b) => a.date.localeCompare(b.date));
	return out;
}

// Serialize back to Rails-like YAML
function serializeInstallments(items: { date: string; sum: number; invoice_no?: string }[]) {
	if (!items?.length) return '--- {}\n';
	let s = '---\n';
	for (const i of items) {
		s += `'${i.date}':\n`;
		s += `  :date: ${i.date}\n`;
		s += `  :sum: ${Number(i.sum).toString()}\n`;
		s += `  :invoice_no: '${i.invoice_no ?? ''}'\n`;
	}
	return s;
}

export async function POST({ params, request }) {
	const id = Number(params.id);
	if (Number.isNaN(id)) return new Response('Invalid ID', { status: 400 });

	const body = await request.json().catch(() => ({}));
	const freezeDateStr = String(body?.frozen_from_date ?? '').slice(0, 10); // YYYY-MM-DD
	if (!/^\d{4}-\d{2}-\d{2}$/.test(freezeDateStr)) {
		return new Response(JSON.stringify({ error: 'Ogiltigt datum' }), { status: 400 });
	}

	// Load current installments + remaining sessions to validate freeze rules
	const [row] = await query(
		`SELECT
       p.payment_installments_per_date,
       p.frozen_from_date,
       a.sessions AS article_sessions,
       (SELECT COUNT(*)::int
          FROM bookings b
          WHERE b.package_id = p.id
            AND (b.status IS NULL OR b.status NOT IN ('Cancelled','Canceled'))
            AND b.start_time <= NOW()
       ) AS used_up
     FROM packages p
     JOIN articles a ON a.id = p.article_id
     WHERE p.id = $1`,
		[id]
	);

	if (!row) return new Response(JSON.stringify({ error: 'Paket hittades inte' }), { status: 404 });

	const installments = parseInstallments(row.payment_installments_per_date);
	const last = installments[installments.length - 1]?.date ?? null;
	const sessions = Number(row.article_sessions ?? 0);
	const used = Number(row.used_up ?? 0);
	const remaining = Math.max(0, sessions - used);

	// Same semantics as old system: must be earlier than the last installment date and sessions remaining
	if (!last || !(freezeDateStr < last)) {
		return new Response(
			JSON.stringify({ error: 'Paketet måste frysas tidigare än sista fakturadatum.' }),
			{ status: 400 }
		);
	}
	if (remaining <= 0) {
		return new Response(JSON.stringify({ error: 'Inga återstående pass – frysning ej möjlig.' }), {
			status: 400
		});
	}

	// Keep only installments up to the freeze date (inclusive)
	const kept = installments.filter((i) => i.date <= freezeDateStr);
	const yaml = serializeInstallments(kept);

	await query(
		`UPDATE packages
       SET frozen_from_date = $2,
           payment_installments_per_date = $3,
           updated_at = NOW()
     WHERE id = $1`,
		[id, freezeDateStr, yaml]
	);

	return new Response(JSON.stringify({ ok: true, frozen_from_date: freezeDateStr }), {
		status: 200
	});
}
