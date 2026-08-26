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

	it('creates customer, client, relationship, package, and notification event', async () => {
		mockedQueryWithClient
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([articleRow()])
			.mockResolvedValueOnce([{ id: 100 }])
			.mockResolvedValueOnce([{ id: 200 }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 300 }])
			.mockResolvedValueOnce([]);

		const response = await POST({ request: jsonRequest(basePayload()) } as any);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toMatchObject({
			message: 'Signup successful',
			clientId: 200,
			customerId: 100,
			packageId: 300,
			clientName: 'Anna Andersson',
			email: 'anna@example.com'
		});
		expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
		expect(mockClient.query).toHaveBeenLastCalledWith('COMMIT');
		expect(mockClient.query).not.toHaveBeenCalledWith('ROLLBACK');

		const customerParams = mockedQueryWithClient.mock.calls[2][2];
		expect(customerParams).toEqual([
			'Anna Andersson',
			'Garvargatan 7',
			'112 21',
			'Stockholm',
			null,
			'anna@example.com',
			'0701234567'
		]);

		const relationshipSql = mockedQueryWithClient.mock.calls[4][1];
		expect(relationshipSql).toContain("'Training'");

		const packageParams = mockedQueryWithClient.mock.calls[5][2];
		expect(packageParams[0]).toBe(100);
		expect(packageParams[1]).toBe(10);
		expect(packageParams[2]).toBe(200);
		expect(packageParams[5]).toBe(true);
		expect(packageParams[6]).toBe('{6}');
		expect(packageParams[8]).toBe('{100}');
		expect(String(packageParams[7])).toContain(":invoice_no: '100'");

		const eventParams = mockedQueryWithClient.mock.calls[6][2];
		expect(eventParams[0]).toBe('Ny klient med ID 200 registrerad via formuläret');
		expect(eventParams[1]).toBe('{2,19}');
		expect(eventParams[5]).toContain('Kund ID: 100');
		expect(eventParams[5]).toContain('Paket ID: 300');
	});

	it('creates only a client and notification event for existing-package signups', async () => {
		mockedQueryWithClient
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 201 }])
			.mockResolvedValueOnce([]);

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
		expect(body).toMatchObject({ clientId: 201, customerId: null, packageId: null });
		expect(mockedQueryWithClient).toHaveBeenCalledTimes(3);

		const clientParams = mockedQueryWithClient.mock.calls[1][2];
		expect(clientParams[0]).toBeNull();

		const eventParams = mockedQueryWithClient.mock.calls[2][2];
		expect(eventParams[5]).toContain(
			'Klienten ska träna på befintligt paket som ägs av Takkei Trainingsystems AB'
		);
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

	it('rejects duplicate client emails and rolls back', async () => {
		mockedQueryWithClient.mockResolvedValueOnce([{ id: 1 }]);

		const response = await POST({ request: jsonRequest(basePayload()) } as any);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.errors.email).toBe('E-post används redan');
		expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
		expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
		expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
	});

	it('rejects unknown packages and rolls back', async () => {
		mockedQueryWithClient.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

		const response = await POST({ request: jsonRequest(basePayload()) } as any);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.errors['training-package']).toBe('Träningspaketet hittades inte');
		expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
		expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
	});

	it('rolls back when a later insert fails', async () => {
		mockedQueryWithClient
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([articleRow()])
			.mockResolvedValueOnce([{ id: 100 }])
			.mockResolvedValueOnce([{ id: 200 }])
			.mockResolvedValueOnce([])
			.mockRejectedValueOnce(new Error('package insert failed'));

		const response = await POST({ request: jsonRequest(basePayload()) } as any);
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body.error).toBe('Ett internt fel uppstod');
		expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
		expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
		expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
	});
});
