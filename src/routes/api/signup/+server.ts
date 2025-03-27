import { query } from '$lib/db';
import { addMonths, format, setDate } from 'date-fns';

export async function POST({ request }) {
	try {
		const data = await request.json();
		const {
			firstname,
			lastname,
			email,
			personnummer,
			phone,
			streetAddress,
			zip,
			city,
			paymentChoice,
			payerName,
			payerEmail,
			payerPhone,
			payerOrganizationNumber,
			payerInvoiceAddress,
			payerInvoiceZip,
			payerInvoiceCity,
			selectedTrainingPackage,
			selectedPaymentMethod,
			installmentsCount = 1
		} = data;

		let extractedPackageName = '';
		if (selectedTrainingPackage) {
			extractedPackageName = selectedTrainingPackage.split(' - ')[0].trim();
		}

		// 1. Create customer (payer)
		const customerResult = await query(
			`
                INSERT INTO customers (name, invoice_address, invoice_zip, invoice_city, organization_number, email, phone, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                RETURNING id
            `,
			[
				payerName,
				payerInvoiceAddress || streetAddress,
				payerInvoiceZip || zip,
				payerInvoiceCity || city,
				payerOrganizationNumber || null,
				payerEmail,
				payerPhone
			]
		);
		const customerId = customerResult[0].id;

		// 2. Create the client
		const clientResult = await query(
			`
            INSERT INTO clients (customer_id, firstname, lastname, email, phone, person_number, active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
            RETURNING id
        `,
			[customerId, firstname, lastname, email, phone, personnummer]
		);

		const clientId = clientResult[0].id;

		// 3. Link client & customer
		await query(
			`
            INSERT INTO client_customer_relationships (customer_id, client_id, relationship, active, created_at, updated_at)
            VALUES ($1, $2, $3, true, NOW(), NOW())
        `,
			[customerId, clientId, paymentChoice === 'self' ? 'self' : 'payer']
		);

		// 4. Assign the training package (if provided)
		let packageId = null;

		if (selectedTrainingPackage) {
			const articleResult = await query(
				`SELECT id, price FROM articles WHERE TRIM(name) = TRIM($1) AND active = true`,
				[extractedPackageName]
			);

			if (articleResult.length > 0) {
				const articleId = articleResult[0].id;
				const totalPrice = articleResult[0].price;

				const installmentCount = installmentsCount > 0 ? installmentsCount : 1;

				const firstPaymentDate = format(setDate(addMonths(new Date(), 1), 27), 'yyyy-MM-dd');

				const installmentAmount = totalPrice / installmentCount;
				const installments: string[] = [];
				const installmentsPerDate: Record<string, any> = {};
				const invoiceNo = customerId;

				for (let i = 0; i < installmentCount; i++) {
					const paymentDate = format(setDate(addMonths(new Date(), i + 1), 27), 'yyyy-MM-dd');

					installments.push(paymentDate);
					installmentsPerDate[paymentDate] = {
						date: paymentDate,
						sum: parseFloat(installmentAmount.toFixed(2)),
						invoice_no: invoiceNo
					};
				}

				let paymentInstallmentsPerDate = '---\n';
				installments.forEach((date, i) => {
					paymentInstallmentsPerDate += `'${date}':\n  :date: '${date}'\n  :sum: ${parseFloat(
						installmentAmount.toFixed(2)
					)}\n  :invoice_no: '${invoiceNo || ''}'\n`;
				});

				const formattedInvoiceNumbers = `{${invoiceNo}}`;

				const packageResult = await query(
					`
                    INSERT INTO packages 
                    (customer_id, article_id, client_id, paid_price, first_payment_date, autogiro, 
                    payment_installments, payment_installments_per_date, invoice_numbers, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, NOW(), NOW())
                    RETURNING id
                    `,
					[
						customerId,
						articleId,
						clientId,
						totalPrice,
						firstPaymentDate,
						`{${installments.length}}`,
						paymentInstallmentsPerDate,
						formattedInvoiceNumbers
					]
				);

				packageId = packageResult[0].id;
			} else {
				console.warn(`Package not found: ${extractedPackageName}`);
			}
		}
		// 5. Return success response
		return new Response(
			JSON.stringify({
				message: 'Signup successful',
				clientId,
				customerId,
				packageId,
				trainingPackage: selectedTrainingPackage || null,
				clientName: `${firstname} ${lastname}`,
				email
			}),
			{ status: 201 }
		);
	} catch (err) {
		console.error('Signup Error:', err.message, err.stack);
		return new Response(JSON.stringify({ error: err.message }), { status: 500 });
	}
}
