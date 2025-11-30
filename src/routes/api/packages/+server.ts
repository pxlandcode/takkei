import { query } from '$lib/db';
import { normalizeDate, serializeInstallments, type InstallmentInput } from '$lib/server/packageUtils';

async function attachEligibleBookings({
        packageId,
        clientId,
        customerId,
        firstPaymentDate,
        articleSessions,
        validityStart,
        validityEnd,
        userId
}: {
        packageId: number;
        clientId?: number | null;
        customerId?: number | null;
        firstPaymentDate: string;
        articleSessions: number;
        validityStart: string | null;
        validityEnd: string | null;
        userId: number | null;
}) {
        if (!articleSessions || articleSessions <= 0) return;

        let clientIds: number[] = [];

        if (clientId) {
                clientIds = [clientId];
        } else if (customerId) {
                const rows = await query(
                        `SELECT client_id FROM client_customer_relationships WHERE customer_id = $1 AND active = TRUE`,
                        [customerId]
                );
                clientIds = rows.map((r: any) => r.client_id).filter((id: any) => typeof id === 'number');
        }

        if (!clientIds.length) return;

        const bookingRows = await query(
                `SELECT id
                 FROM bookings
                 WHERE package_id IS NULL
                   AND client_id = ANY($1::int[])
                   AND (status IS NULL OR status NOT IN ('Cancelled','Canceled'))
                   AND ($3::date IS NULL OR start_time::date >= $3::date)
                   AND ($4::date IS NULL OR start_time::date <= $4::date)
                 ORDER BY start_time ASC
                 LIMIT $2`,
                [clientIds, articleSessions, validityStart, validityEnd]
        );

        const bookingIds = bookingRows.map((r: any) => r.id).filter((id: any) => typeof id === 'number');
        if (!bookingIds.length) return;

        await query(
                `UPDATE bookings
                 SET package_id = $1,
                     added_to_package_date = $2,
                     added_to_package_by = $3,
                     updated_at = NOW()
                 WHERE id = ANY($4::int[])`,
                [packageId, firstPaymentDate, userId, bookingIds]
        );
}

export async function GET({ url }) {
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const sortBy = url.searchParams.get('sortBy') || 'product';
        const sortOrder = url.searchParams.get('sortOrder')?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        const search = url.searchParams.get('search')?.trim() || '';

        const validSortFields = ['product', 'customer', 'client']; // Whitelist
        const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'product';

        const params = [];
        let paramIndex = 1;

        let sql = `
                SELECT
            p.id,
            a.name AS product,
            cu.id AS customer_id,
            cu.name AS customer_name,
            cl.id AS client_id,
            cl.firstname,
            cl.lastname,
            (
                SELECT COUNT(*) FROM bookings b
                WHERE b.package_id = p.id
            ) AS bookings,
            p.payment_installments_per_date,
            p.frozen_from_date
        FROM packages p
        JOIN articles a ON p.article_id = a.id
        JOIN customers cu ON p.customer_id = cu.id
        LEFT JOIN clients cl ON p.client_id = cl.id
        `;

        // Search on customer, product or client
        if (search) {
                sql += `
                        AND (
                                a.name ILIKE $${paramIndex++} OR
                                cu.name ILIKE $${paramIndex++} OR
                                (cl.firstname || ' ' || cl.lastname) ILIKE $${paramIndex++}
                        )
                `;
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        sql += `
                ORDER BY ${safeSortBy} ${sortOrder}
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;

        params.push(limit, offset);

        try {
                const raw = await query(sql, params);

                const result = raw.map((row) => {
                        const yaml = row.payment_installments_per_date || '';
                        const payments = yaml.split('\n').filter((line) => line.trim().startsWith("'"))
                                .length;

                        return {
                                id: row.id,
                                product: row.product,
                                bookings: row.bookings,
                                payments,
                                frozen: row.frozen_from_date ? 'Ja' : 'Nej',
                                client: row.client_id
                                        ? {
                                                        id: row.client_id,
                                                        firstname: row.firstname,
                                                        lastname: row.lastname,
                                                        name: `${row.firstname} ${row.lastname}`
                                                }
                                        : null,
                                customer: {
                                        id: row.customer_id,
                                        name: row.customer_name
                                }
                        };
                });

                return new Response(JSON.stringify(result), { status: 200 });
        } catch (err) {
                console.error('Error fetching packages:', err);
                return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
        }
}

export async function POST({ request, locals }) {
        try {
                const body = await request.json();

                const customerId = body.customerId ?? null;
                const clientId = body.clientId ?? null;
                const articleId = Number(body.articleId);
                const autogiro = !!body.autogiro;
                const installmentsCount = Number(body.installments ?? 0);
                const providedFirstPayment = normalizeDate(body.firstPaymentDate) ?? new Date().toISOString().slice(0, 10);
                const currentUserId = locals?.user?.id ?? null;

                if (!customerId && !clientId) {
                        return new Response(JSON.stringify({ error: 'Kund eller klient måste anges' }), { status: 400 });
                }
                if (!articleId || Number.isNaN(articleId)) {
                        return new Response(JSON.stringify({ error: 'Ogiltig produkt' }), { status: 400 });
                }

                const [article] = await query(
                        `SELECT price, sessions, validity_start_date, validity_end_date FROM articles WHERE id = $1`,
                        [articleId]
                );

                if (!article) {
                        return new Response(JSON.stringify({ error: 'Produkten hittades inte' }), { status: 404 });
                }

                const paidPrice = typeof body.price === 'number' && !Number.isNaN(body.price)
                        ? Number(body.price)
                        : Number(article.price ?? 0);

                const installmentsRaw: InstallmentInput[] = Array.isArray(body.installmentBreakdown)
                        ? body.installmentBreakdown
                        : [];

                if (!installmentsRaw.length || installmentsCount !== installmentsRaw.length) {
                        return new Response(JSON.stringify({ error: 'Antal faktureringstillfällen stämmer inte' }), {
                                status: 400
                        });
                }

                const normalizedInstallments = installmentsRaw.map((i: InstallmentInput) => ({
                        date: normalizeDate(i.date) ?? providedFirstPayment,
                        sum: Number(i.sum) || 0,
                        invoice_no: i.invoice_no ?? ''
                }));

                const totalInstallmentsSum = normalizedInstallments.reduce((acc, i) => acc + Number(i.sum || 0), 0);
                if (Math.abs(totalInstallmentsSum - paidPrice) > 0.01) {
                        return new Response(JSON.stringify({ error: 'Summan av delbetalningarna måste matcha paketpriset' }), {
                                status: 400
                        });
                }

                const yamlData = serializeInstallments(normalizedInstallments);

		const invoiceNumberRaw = typeof body.invoiceNumber === 'string' ? body.invoiceNumber.trim() : '';
		const invoiceNumber = invoiceNumberRaw.length > 0 ? invoiceNumberRaw : null;

		const invoiceNumbersArray = (Array.isArray(body.invoiceNumbers) ? body.invoiceNumbers : [])
			.map((n: any) => Number(n))
			.filter((n: number) => Number.isInteger(n));

		const invoiceNumberAsInt = invoiceNumber !== null ? Number(invoiceNumber) : null;
		if (
			invoiceNumberAsInt !== null &&
			Number.isInteger(invoiceNumberAsInt) &&
			!invoiceNumbersArray.includes(invoiceNumberAsInt)
		) {
			invoiceNumbersArray.push(invoiceNumberAsInt);
		}

		const invoiceNumbersStr = invoiceNumbersArray.length > 0 ? `{${invoiceNumbersArray.join(',')}}` : '{}';
		const paymentInstallmentsStr = normalizedInstallments.length > 0 ? `{${normalizedInstallments.length}}` : null;

                const sql = `
                        INSERT INTO packages (
                                customer_id,
                                article_id,
                                client_id,
                                paid_price,
                                invoice_no,
                                first_payment_date,
                                autogiro,
                                payment_installments_per_date,
                                invoice_numbers,
                                payment_installments,
                                created_at,
                                updated_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
                        RETURNING id
                `;

                const params = [
                        customerId,
                        articleId,
                        clientId || null,
                        paidPrice,
                        invoiceNumber,
                        providedFirstPayment,
                        autogiro,
                        yamlData,
                        invoiceNumbersStr,
                        paymentInstallmentsStr
                ];

                const result = await query(sql, params);

                await attachEligibleBookings({
                        packageId: result[0].id,
                        clientId,
                        customerId,
                        firstPaymentDate: providedFirstPayment,
                        articleSessions: Number(article.sessions ?? 0),
                        validityStart: article.validity_start_date,
                        validityEnd: article.validity_end_date,
                        userId: currentUserId
                });

                return new Response(JSON.stringify({ id: result[0].id }), { status: 201 });
        } catch (err) {
                console.error('Error creating package:', err);
                return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
        }
}
