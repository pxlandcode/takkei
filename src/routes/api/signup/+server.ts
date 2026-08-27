import * as db from '$lib/db';
import { serializeInstallments, type InstallmentInput } from '$lib/server/packageUtils';
import { json, type RequestHandler } from '@sveltejs/kit';
import { addMonths, format, setDate } from 'date-fns';
import { randomBytes } from 'crypto';
import type { PoolClient } from 'pg';

type DbWithClientQuery = typeof db & {
	queryWithClient: <T = Record<string, unknown>>(
		client: PoolClient,
		text: string,
		params?: unknown[]
	) => Promise<T[]>;
};

type SignupPayload = {
	firstname: string;
	lastname: string;
	email: string;
	person_number: string;
	phone: string;
	streetAddress: string;
	zip: string;
	city: string;
	agreeToTerms: boolean;
	agreeToPrivacy: boolean;
	existingPackage: boolean;
	existingPackageOwner: string;
	selectedTrainingPackage: string;
	autogiro: boolean;
	paymentChoice: 'self' | 'company';
	payerName: string;
	payerEmail: string;
	payerPhone: string;
	payerOrganizationNumber: string;
	payerInvoiceAddress: string;
	payerInvoiceZip: string;
	payerInvoiceCity: string;
	installmentsCount: number;
};

type SignupArticle = {
	id: number;
	name: string;
	price: number | string;
	sessions: number | null;
};

const { pool } = db;
const { queryWithClient } = db as DbWithClientQuery;

function text(value: unknown) {
	return typeof value === 'string' ? value.trim() : '';
}

function bool(value: unknown) {
	return value === true;
}

function positiveInt(value: unknown, fallback: number) {
	const numeric = Number(value);
	if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
	return Math.trunc(numeric);
}

function normalizePayload(body: Record<string, unknown>): SignupPayload {
	const firstname = text(body.firstname);
	const lastname = text(body.lastname);
	const email = text(body.email).toLowerCase();
	const phone = text(body.phone);
	const streetAddress = text(body.streetAddress);
	const zip = text(body.zip);
	const city = text(body.city);
	const existingPackage = bool(body.existingPackage);
	const paymentChoice = text(body.paymentChoice) === 'company' ? 'company' : 'self';

	return {
		firstname,
		lastname,
		email,
		person_number: text(body.person_number ?? body.personnummer),
		phone,
		streetAddress,
		zip,
		city,
		agreeToTerms: bool(body.agreeToTerms),
		agreeToPrivacy: bool(body.agreeToPrivacy),
		existingPackage,
		existingPackageOwner: text(body.existingPackageOwner),
		selectedTrainingPackage: text(body.selectedTrainingPackage),
		autogiro: bool(body.autogiro),
		paymentChoice,
		payerName: existingPackage
			? ''
			: paymentChoice === 'company'
				? text(body.payerName)
				: `${firstname} ${lastname}`.trim(),
		payerEmail: existingPackage
			? ''
			: paymentChoice === 'company'
				? text(body.payerEmail).toLowerCase()
				: email,
		payerPhone: existingPackage ? '' : paymentChoice === 'company' ? text(body.payerPhone) : phone,
		payerOrganizationNumber: paymentChoice === 'company' ? text(body.payerOrganizationNumber) : '',
		payerInvoiceAddress: existingPackage
			? ''
			: paymentChoice === 'company'
				? text(body.payerInvoiceAddress)
				: streetAddress,
		payerInvoiceZip: existingPackage
			? ''
			: paymentChoice === 'company'
				? text(body.payerInvoiceZip)
				: zip,
		payerInvoiceCity: existingPackage
			? ''
			: paymentChoice === 'company'
				? text(body.payerInvoiceCity)
				: city,
		installmentsCount: positiveInt(body.installmentsCount, 1)
	};
}

function isValidEmail(email: string) {
	return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function isValidPersonOrOrgNumber(value: string) {
	return /^\d{6}-\d{4}$/.test(value);
}

function isValidZip(value: string) {
	return /^\d{3} ?\d{2}$/.test(value);
}

function validatePayload(payload: SignupPayload) {
	const errors: Record<string, string> = {};

	if (!payload.firstname) errors.firstname = 'Förnamn är obligatoriskt';
	if (!payload.lastname) errors.lastname = 'Efternamn är obligatoriskt';
	if (!isValidEmail(payload.email)) errors.email = 'Ogiltig e-postadress';
	if (!isValidPersonOrOrgNumber(payload.person_number)) {
		errors.person_number = 'Ogiltigt personnummer (format: ÅÅMMDD-XXXX)';
	}
	if (!payload.phone) errors.phone = 'Ogiltigt telefonnummer';
	if (!payload.streetAddress) errors.streetAddress = 'Gatuadress är obligatorisk';
	if (!isValidZip(payload.zip)) errors.zip = 'Ogiltigt postnummer';
	if (!payload.city) errors.city = 'Ort är obligatorisk';
	if (!payload.agreeToTerms) errors['accept-terms'] = 'Du måste godkänna villkoren';
	if (!payload.agreeToPrivacy) {
		errors['accept-handling-of-personal-data'] = 'Du måste godkänna hantering av personuppgifter';
	}

	if (payload.existingPackage) {
		if (!payload.existingPackageOwner) {
			errors.existingPackageOwner = 'Fyll i ägaren av det befintliga paketet';
		}
		return errors;
	}

	if (!payload.selectedTrainingPackage) errors['training-package'] = 'Välj ett träningspaket';
	if (!payload.installmentsCount) errors['payment-installment'] = 'Välj en delbetalning';

	if (payload.paymentChoice === 'company') {
		if (!payload.payerName) errors.payerName = 'Företagsnamn/Namn är obligatoriskt';
		if (!isValidEmail(payload.payerEmail)) errors.payerEmail = 'Ogiltig e-postadress';
		if (!payload.payerPhone) errors.payerPhone = 'Ogiltigt telefonnummer';
		if (!isValidPersonOrOrgNumber(payload.payerOrganizationNumber)) {
			errors.payerOrganizationNumber = 'Organisationsnummer/Personnummer är obligatoriskt';
		}
		if (!payload.payerInvoiceAddress) {
			errors.payerInvoiceAddress = 'Fakturaadress är obligatorisk';
		}
		if (!isValidZip(payload.payerInvoiceZip)) errors.payerInvoiceZip = 'Ogiltigt postnummer';
		if (!payload.payerInvoiceCity) errors.payerInvoiceCity = 'Ort är obligatorisk';
	}

	return errors;
}

function packageNameFromSelection(selectedTrainingPackage: string) {
	return selectedTrainingPackage.split(' - ')[0]?.trim() ?? '';
}

function extractSessionCount(name: string) {
	const match = name.match(/(\d+)/);
	return match ? Number(match[1]) : 0;
}

function allowedInstallmentCounts(article: SignupArticle) {
	const sessions = Number(article.sessions) || extractSessionCount(article.name);
	const allowed = [1];
	if (sessions >= 12) allowed.push(3);
	if (sessions >= 24) allowed.push(6);
	if (sessions >= 48) allowed.push(12);
	return allowed;
}

async function txQuery<T = Record<string, unknown>>(
	client: PoolClient,
	sql: string,
	params: unknown[] = []
) {
	return queryWithClient<T>(client, sql, params);
}

async function rollback(client: PoolClient) {
	try {
		await client.query('ROLLBACK');
	} catch (error) {
		console.error('Failed to rollback signup transaction:', error);
	}
}

function pgIntArray(values: number[]) {
	return values.length ? `{${values.join(',')}}` : '{}';
}

function buildInstallments(totalPrice: number, installmentsCount: number, invoiceNo: number) {
	const count = installmentsCount > 0 ? installmentsCount : 1;
	const installmentAmount = totalPrice / count;

	return Array.from({ length: count }, (_, index): InstallmentInput => {
		const paymentDate = format(setDate(addMonths(new Date(), index + 1), 27), 'yyyy-MM-dd');
		return {
			date: paymentDate,
			sum: Number(installmentAmount.toFixed(2)),
			invoice_no: String(invoiceNo)
		};
	});
}

export const POST: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ error: 'Ogiltig kropp' }, { status: 400 });
	}

	const payload = normalizePayload(body);
	const errors = validatePayload(payload);

	if (Object.keys(errors).length > 0) {
		return json({ success: false, errors }, { status: 400 });
	}

	const client = await pool.connect();
	let transactionStarted = false;

	try {
		await client.query('BEGIN');
		transactionStarted = true;

		const packageName = packageNameFromSelection(payload.selectedTrainingPackage);
		let article: SignupArticle | null = null;

		if (!payload.existingPackage) {
			const articles = await txQuery<SignupArticle>(
				client,
				`
				SELECT id, name, price, sessions
				FROM articles
				WHERE TRIM(name) = TRIM($1)
					AND active = true
					AND (name LIKE '12 träningar%' OR name LIKE '24 träningar%' OR name LIKE '48 träningar%')
				LIMIT 1
				`,
				[packageName]
			);
			article = articles[0] ?? null;

			if (!article) {
				await rollback(client);
				transactionStarted = false;
				return json(
					{ success: false, errors: { 'training-package': 'Träningspaketet hittades inte' } },
					{ status: 400 }
				);
			}

			if (!allowedInstallmentCounts(article).includes(payload.installmentsCount)) {
				await rollback(client);
				transactionStarted = false;
				return json(
					{ success: false, errors: { 'payment-installment': 'Ogiltigt antal delbetalningar' } },
					{ status: 400 }
				);
			}
		}

		let customerId: number | null = null;

		if (!payload.existingPackage) {
			const customerResult = await txQuery<{ id: number }>(
				client,
				`
				INSERT INTO customers
					(name, invoice_address, invoice_zip, invoice_city, organization_number, email, phone, active, created_at, updated_at)
				VALUES
					($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
				RETURNING id
				`,
				[
					payload.payerName,
					payload.payerInvoiceAddress,
					payload.payerInvoiceZip,
					payload.payerInvoiceCity,
					payload.payerOrganizationNumber || null,
					payload.payerEmail,
					payload.payerPhone
				]
			);
			customerId = customerResult[0].id;
		}

		const clientKey = randomBytes(32).toString('hex');
		const clientResult = await txQuery<{ id: number }>(
			client,
			`
			INSERT INTO clients
				(customer_id, firstname, lastname, email, phone, person_number, key, active, created_at, updated_at)
			VALUES
				($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
			RETURNING id
			`,
			[
				customerId,
				payload.firstname,
				payload.lastname,
				payload.email,
				payload.phone,
				payload.person_number,
				clientKey
			]
		);
		const clientId = clientResult[0].id;

		if (!payload.existingPackage && customerId) {
			await txQuery(
				client,
				`
				INSERT INTO client_customer_relationships
					(customer_id, client_id, relationship, active, created_at, updated_at)
				VALUES
					($1, $2, 'Training', true, NOW(), NOW())
				`,
				[customerId, clientId]
			);
		}

		let packageId: number | null = null;

		if (!payload.existingPackage && article && customerId) {
			const totalPrice = Number(article.price ?? 0);
			const installments = buildInstallments(totalPrice, payload.installmentsCount, customerId);
			const firstPaymentDate = installments[0]?.date ?? format(new Date(), 'yyyy-MM-dd');
			const paymentInstallmentsPerDate = serializeInstallments(installments);
			const paymentInstallments = `{${installments.length}}`;
			const invoiceNumbers = pgIntArray([customerId]);

			const packageResult = await txQuery<{ id: number }>(
				client,
				`
				INSERT INTO packages
					(customer_id, article_id, client_id, paid_price, first_payment_date, autogiro,
					 payment_installments, payment_installments_per_date, invoice_numbers, created_at, updated_at)
				VALUES
					($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
				RETURNING id
				`,
				[
					customerId,
					article.id,
					clientId,
					totalPrice,
					firstPaymentDate,
					payload.autogiro,
					paymentInstallments,
					paymentInstallmentsPerDate,
					invoiceNumbers
				]
			);
			packageId = packageResult[0].id;
		}

		const caseResult = await txQuery<{ id: number }>(
			client,
			`
			INSERT INTO signup_onboarding_cases (
				submitted_payload,
				provisional_client_id,
				provisional_customer_id,
				provisional_package_id,
				resolved_client_id,
				resolved_customer_id,
				resolved_package_id
			)
			VALUES ($1::jsonb, $2, $3, $4, $2, $3, $4)
			RETURNING id
			`,
			[JSON.stringify(payload), clientId, customerId, packageId]
		);
		const onboardingCaseId = caseResult[0].id;

		await client.query('COMMIT');
		transactionStarted = false;

		return json(
			{
				message: 'Signup successful',
				clientId,
				customerId,
				packageId,
				onboardingCaseId,
				trainingPackage: payload.selectedTrainingPackage || null,
				clientName: `${payload.firstname} ${payload.lastname}`.trim(),
				email: payload.email
			},
			{ status: 201 }
		);
	} catch (err) {
		if (transactionStarted) {
			await rollback(client);
		}

		const error = err instanceof Error ? err : new Error(String(err));
		console.error('Signup Error:', error.message, error.stack);
		return json({ error: 'Ett internt fel uppstod' }, { status: 500 });
	} finally {
		client.release();
	}
};
