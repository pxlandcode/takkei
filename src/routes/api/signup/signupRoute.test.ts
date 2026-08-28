import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockClient = {
	query: vi.fn(),
	release: vi.fn()
};

vi.mock('$lib/db', () => ({
	pool: {
		connect: vi.fn()
	},
	queryWithClient: vi.fn()
}));

import * as db from '$lib/db';
import { POST } from './+server';

const mockedPool = db.pool as unknown as { connect: ReturnType<typeof vi.fn> };
const mockedQueryWithClient = (db as unknown as { queryWithClient: ReturnType<typeof vi.fn> })
	.queryWithClient;

function jsonRequest(body: Record<string, unknown>) {
	return new Request('http://localhost/api/signup', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

function basePayload(overrides: Record<string, unknown> = {}) {
	return {
		firstname: 'Anna',
		lastname: 'Andersson',
		email: 'anna@example.com',
		person_number: '900101-1234',
		phone: '0701234567',
		streetAddress: 'Garvargatan 7',
		zip: '112 21',
		city: 'Stockholm',
		agreeToTerms: true,
		agreeToPrivacy: true,
		existingPackage: false,
		existingPackageOwner: '',
		selectedTrainingPackage: '24 träningar - 34 080kr',
		autogiro: true,
		paymentChoice: 'self',
		installmentsCount: 6,
		...overrides
	};
}

function articleRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 10,
		name: '24 träningar',
		price: 32150.94,
		sessions: 24,
		...overrides
	};
}

describe('/api/signup', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedPool.connect.mockResolvedValue(mockClient);
		mockClient.query.mockResolvedValue({ rows: [] });
	});

	it('creates customer, client, relationship, package, and onboarding case', async () => {
		mockedQueryWithClient
			.mockResolvedValueOnce([articleRow()])
			.mockResolvedValueOnce([{ id: 100 }])
			.mockResolvedValueOnce([{ id: 200 }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 300 }])
			.mockResolvedValueOnce([{ id: 400 }]);

		const response = await POST({ request: jsonRequest(basePayload()) } as any);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toMatchObject({
			message: 'Signup successful',
			clientId: 200,
			customerId: 100,
			packageId: 300,
			onboardingCaseId: 400,
			clientName: 'Anna Andersson',
			email: 'anna@example.com'
		});
		expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
		expect(mockClient.query).toHaveBeenLastCalledWith('COMMIT');
		expect(mockClient.query).not.toHaveBeenCalledWith('ROLLBACK');

		const customerParams = mockedQueryWithClient.mock.calls[1][2];
		expect(customerParams).toEqual([
			'Anna Andersson',
			'Garvargatan 7',
			'112 21',
			'Stockholm',
			null,
			'anna@example.com',
			'0701234567'
		]);

		const relationshipSql = mockedQueryWithClient.mock.calls[3][1];
		expect(relationshipSql).toContain("'Training'");

		const packageParams = mockedQueryWithClient.mock.calls[4][2];
		expect(packageParams[0]).toBe(100);
		expect(packageParams[1]).toBe(10);
		expect(packageParams[2]).toBe(200);
		expect(packageParams[5]).toBe(true);
		expect(packageParams[6]).toBe('{6}');
		expect(packageParams[8]).toBe('{100}');
		expect(String(packageParams[7])).toContain(":invoice_no: '100'");

		const caseSql = mockedQueryWithClient.mock.calls[5][1];
		const caseParams = mockedQueryWithClient.mock.calls[5][2];
		expect(caseSql).toContain('INSERT INTO signup_onboarding_cases');
		expect(JSON.parse(caseParams[0])).toMatchObject({ email: 'anna@example.com', autogiro: true });
		expect(caseParams.slice(1)).toEqual([200, 100, 300]);
	});

	it('accepts unrestricted organization numbers for company payers', async () => {
		mockedQueryWithClient
			.mockResolvedValueOnce([articleRow()])
			.mockResolvedValueOnce([{ id: 100 }])
			.mockResolvedValueOnce([{ id: 200 }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 300 }])
			.mockResolvedValueOnce([{ id: 400 }]);

		const response = await POST({
			request: jsonRequest(
				basePayload({
					paymentChoice: 'company',
					payerName: 'Takkei AB',
					payerEmail: 'invoice@example.com',
					payerPhone: '0812345678',
					payerOrganizationNumber: 'SE 556725-6556 VAT',
					payerInvoiceAddress: 'Fakturagatan 1',
					payerInvoiceZip: '111 22',
					payerInvoiceCity: 'Stockholm'
				})
			)
		} as any);

		expect(response.status).toBe(201);

		const customerParams = mockedQueryWithClient.mock.calls[1][2];
		expect(customerParams[4]).toBe('SE 556725-6556 VAT');
		expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
	});

	it('creates a client and onboarding case for existing-package signups', async () => {
		mockedQueryWithClient.mockResolvedValueOnce([{ id: 201 }]).mockResolvedValueOnce([{ id: 401 }]);

		const response = await POST({
			request: jsonRequest(
				basePayload({
					existingPackage: true,
					existingPackageOwner: 'Takkei Trainingsystems AB',
					selectedTrainingPackage: null,
					autogiro: null,
					installmentsCount: null
				})
			)
		} as any);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toMatchObject({
			clientId: 201,
			customerId: null,
			packageId: null,
			onboardingCaseId: 401
		});
		expect(mockedQueryWithClient).toHaveBeenCalledTimes(2);

		const clientParams = mockedQueryWithClient.mock.calls[0][2];
		expect(clientParams[0]).toBeNull();

		const caseParams = mockedQueryWithClient.mock.calls[1][2];
		expect(JSON.parse(caseParams[0])).toMatchObject({
			existingPackage: true,
			existingPackageOwner: 'Takkei Trainingsystems AB'
		});
		expect(caseParams.slice(1)).toEqual([201, null, null]);
		expect(mockClient.query).toHaveBeenLastCalledWith('COMMIT');
	});

	it('rejects invalid payloads before opening a transaction', async () => {
		const response = await POST({
			request: jsonRequest(
				basePayload({
					firstname: '',
					email: 'not-an-email',
					person_number: '9001011234',
					zip: '1122',
					agreeToTerms: false,
					agreeToPrivacy: false,
					selectedTrainingPackage: ''
				})
			)
		} as any);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.errors).toMatchObject({
			firstname: 'Förnamn är obligatoriskt',
			email: 'Ogiltig e-postadress',
			person_number: 'Ogiltigt personnummer (format: ÅÅMMDD-XXXX)',
			zip: 'Ogiltigt postnummer',
			'accept-terms': 'Du måste godkänna villkoren',
			'accept-handling-of-personal-data': 'Du måste godkänna hantering av personuppgifter',
			'training-package': 'Välj ett träningspaket'
		});
		expect(mockedPool.connect).not.toHaveBeenCalled();
	});

	it('allows duplicate client emails so administrators can merge them', async () => {
		mockedQueryWithClient
			.mockResolvedValueOnce([articleRow()])
			.mockResolvedValueOnce([{ id: 100 }])
			.mockResolvedValueOnce([{ id: 200 }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 300 }])
			.mockResolvedValueOnce([{ id: 400 }]);

		const response = await POST({ request: jsonRequest(basePayload()) } as any);

		expect(response.status).toBe(201);
		expect(
			mockedQueryWithClient.mock.calls.some(([sql]) => String(sql).includes('LOWER(email)'))
		).toBe(false);
		expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
		expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
	});

	it('rejects unknown packages and rolls back', async () => {
		mockedQueryWithClient.mockResolvedValueOnce([]);

		const response = await POST({ request: jsonRequest(basePayload()) } as any);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.errors['training-package']).toBe('Träningspaketet hittades inte');
		expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
		expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
	});

	it('rolls back when a later insert fails', async () => {
		mockedQueryWithClient
			.mockResolvedValueOnce([articleRow()])
			.mockResolvedValueOnce([{ id: 100 }])
			.mockResolvedValueOnce([{ id: 200 }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 300 }])
			.mockRejectedValueOnce(new Error('onboarding insert failed'));

		const response = await POST({ request: jsonRequest(basePayload()) } as any);
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body.error).toBe('Ett internt fel uppstod');
		expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
		expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
		expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
	});
});
