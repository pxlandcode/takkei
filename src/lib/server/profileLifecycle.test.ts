import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db', () => ({
	pool: { connect: vi.fn() },
	queryWithClient: vi.fn(async (client: any, text: string, params: unknown[] = []) => {
		const result = await client.query(text, params);
		return result.rows;
	})
}));

vi.mock('$lib/server/packageReallocation', () => ({
	reallocateFuturePackageAssignmentsForClient: vi.fn(async () => ({ assignedFutureBookings: 0 }))
}));

import {
	deleteClientProfile,
	getClientDeleteActionFromCounts,
	getClientMergePreview,
	getCustomerDeleteActionFromCounts,
	getCustomerMergePreview,
	mergeClientProfiles,
	mergeCustomerProfiles
} from './profileLifecycle';
import { reallocateFuturePackageAssignmentsForClient } from '$lib/server/packageReallocation';

type QueryCall = { sql: string; params: unknown[] };
const mockedReallocateFuturePackageAssignmentsForClient = vi.mocked(
	reallocateFuturePackageAssignmentsForClient
);

class FakeClient {
	clientRow: any = {
		id: 123,
		firstname: 'Test',
		lastname: 'Client',
		email: 'test@example.com',
		alternative_email: 'alt@example.com',
		phone: '0701234567',
		person_number: '800101-1234',
		gdpr_deleted_at: null,
		gdpr_delete_token: null,
		merged_into_client_id: null
	};
	targetClientRow: any = {
		id: 456,
		firstname: 'Keeper',
		lastname: 'Client',
		email: 'keeper@example.com',
		alternative_email: null,
		phone: null,
		person_number: '900101-1234',
		membership_number: null,
		gdpr_deleted_at: null,
		gdpr_delete_token: null,
		merged_into_client_id: null
	};
	customerRow: any = {
		id: 321,
		name: 'Test Customer',
		email: 'customer@example.com',
		phone: '08123456',
		organization_number: '556677-8899',
		customer_no: 'C-123',
		gdpr_deleted_at: null,
		gdpr_delete_token: null,
		merged_into_customer_id: null
	};
	targetCustomerRow: any = {
		id: 654,
		name: 'Keeper Customer',
		email: 'keeper-customer@example.com',
		phone: null,
		organization_number: '112233-4455',
		customer_no: null,
		invoice_address: null,
		invoice_zip: '12345',
		invoice_city: 'Stockholm',
		invoice_reference: null,
		gdpr_deleted_at: null,
		gdpr_delete_token: null,
		merged_into_customer_id: null
	};
	affectedClientIds: number[];
	counts: Record<string, number>;
	optionalTables: Set<string>;
	calls: QueryCall[] = [];

	constructor({
		counts = {},
		optionalTables = [],
		affectedClientIds = []
	}: {
		counts?: Record<string, number>;
		optionalTables?: string[];
		affectedClientIds?: number[];
	} = {}) {
		this.counts = counts;
		this.optionalTables = new Set(optionalTables);
		this.affectedClientIds = affectedClientIds;
	}

	async query(text: string, params: unknown[] = []) {
		const sql = text.replace(/\s+/g, ' ').trim();
		this.calls.push({ sql, params });

		if (sql.includes('to_regclass')) {
			const tableName = String(params[0] ?? '').replace(/^public\./, '');
			return { rows: [{ exists: this.optionalTables.has(tableName) }] };
		}

		if (
			sql.startsWith('SELECT * FROM clients') ||
			(sql.startsWith('SELECT c.*, lifecycle') && sql.includes('FROM clients c'))
		) {
			return { rows: [Number(params[0]) === 456 ? this.targetClientRow : this.clientRow] };
		}

		if (
			sql.startsWith('SELECT * FROM customers') ||
			(sql.startsWith('SELECT c.*, lifecycle') && sql.includes('FROM customers c'))
		) {
			return { rows: [Number(params[0]) === 654 ? this.targetCustomerRow : this.customerRow] };
		}

		if (sql.startsWith('SELECT id, firstname, lastname') || sql.startsWith('SELECT c.id, c.firstname')) {
			return { rows: [Number(params[0]) === 456 ? this.targetClientRow : this.clientRow] };
		}

		if (sql.startsWith('SELECT id, name, gdpr_deleted_at') || sql.startsWith('SELECT c.id, c.name')) {
			return { rows: [Number(params[0]) === 654 ? this.targetCustomerRow : this.customerRow] };
		}

		if (sql.startsWith('SELECT DISTINCT id FROM')) {
			return { rows: this.affectedClientIds.map((id) => ({ id })) };
		}

		if (sql.startsWith('SELECT id FROM auth_user')) {
			return { rows: [{ id: 'client:123' }] };
		}

		if (sql.includes('COUNT(*)')) {
			return { rows: [{ count: this.countFor(sql) }] };
		}

		return { rows: [] };
	}

	countFor(sql: string) {
		if (sql.includes('FROM bookings')) return this.counts.bookings ?? 0;
		if (sql.includes('FROM packages')) return this.counts.packages ?? 0;
		if (sql.includes('FROM memberships')) return this.counts.memberships ?? 0;
		if (sql.includes('FROM invoice_reminders')) return this.counts.invoiceReminders ?? 0;
		if (sql.includes('FROM client_customer_relationships')) {
			return this.counts.customerRelationships ?? 0;
		}
		if (sql.includes('FROM notes')) return this.counts.notes ?? 0;
		if (sql.includes('FROM standby_times')) return this.counts.standbyTimes ?? 0;
		if (sql.includes('FROM auth_user')) return this.counts.authUsers ?? 0;
		return 0;
	}

	hasSql(fragment: string) {
		return this.calls.some((call) => call.sql.includes(fragment));
	}
}

describe('profileLifecycle', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('chooses hard delete only when client has no retained business records', () => {
		expect(
			getClientDeleteActionFromCounts({
				bookings: 0,
				packages: 0,
				memberships: 0,
				invoiceReminders: 0
			})
		).toBe('hard_delete');

		expect(
			getClientDeleteActionFromCounts({
				bookings: 1,
				packages: 0,
				memberships: 0,
				invoiceReminders: 0
			})
		).toBe('anonymize');
	});

	it('chooses hard delete only when customer has no packages or memberships', () => {
		expect(getCustomerDeleteActionFromCounts({ packages: 0, memberships: 0 })).toBe(
			'hard_delete'
		);
		expect(getCustomerDeleteActionFromCounts({ packages: 0, memberships: 1 })).toBe(
			'anonymize'
		);
		expect(getCustomerDeleteActionFromCounts({ packages: 1, memberships: 0 })).toBe(
			'anonymize'
		);
	});

	it('anonymizes a client with retained records and cleans side tables', async () => {
		const client = new FakeClient({
			counts: {
				bookings: 2,
				packages: 1,
				memberships: 0,
				invoiceReminders: 1,
				customerRelationships: 1,
				notes: 2,
				standbyTimes: 1,
				authUsers: 1
			},
			optionalTables: [
				'invoice_reminders',
				'notes',
				'booking_notes',
				'standby_times',
				'auth_user',
				'auth_session',
				'auth_key',
				'mail_history',
				'audit_log'
			]
		});

		const result = await deleteClientProfile({
			client: client as any,
			clientId: 123,
			actorUserId: 7
		});

		expect(result.action).toBe('anonymized');
		expect(client.hasSql("UPDATE clients SET customer_id = NULL")).toBe(true);
		expect(client.hasSql('INSERT INTO gdpr_profile_lifecycle')).toBe(true);
		expect(client.hasSql("firstname = 'Borttagen klient'")).toBe(true);
		expect(client.hasSql('DELETE FROM auth_session')).toBe(true);
		expect(client.hasSql('DELETE FROM auth_key')).toBe(true);
		expect(client.hasSql('DELETE FROM auth_user')).toBe(true);
		expect(client.hasSql('DELETE FROM booking_notes')).toBe(true);
		expect(client.hasSql('DELETE FROM notes WHERE target_type')).toBe(true);
		expect(client.hasSql('DELETE FROM standby_times')).toBe(true);
		expect(client.hasSql('SET active = FALSE')).toBe(true);
		expect(client.hasSql('UPDATE mail_history')).toBe(true);
		expect(client.hasSql('UPDATE audit_log')).toBe(true);
		expect(client.hasSql('DELETE FROM clients WHERE id')).toBe(false);
	});

	it('hard-deletes a client without retained records after cleanup', async () => {
		const client = new FakeClient({
			counts: {
				bookings: 0,
				packages: 0,
				memberships: 0,
				invoiceReminders: 0,
				customerRelationships: 1,
				notes: 0
			},
			optionalTables: ['notes']
		});

		const result = await deleteClientProfile({
			client: client as any,
			clientId: 123,
			actorUserId: 7
		});

		expect(result.action).toBe('hard_deleted');
		expect(result.hardDeleted).toBe(true);
		expect(client.hasSql('DELETE FROM client_customer_relationships WHERE client_id')).toBe(true);
		expect(client.hasSql('DELETE FROM clients WHERE id')).toBe(true);
		expect(client.hasSql("firstname = 'Borttagen klient'")).toBe(false);
	});

	it('previews client merge with target fields kept and empty target fields filled from source', async () => {
		const client = new FakeClient();

		const preview = await getClientMergePreview({
			client: client as any,
			sourceClientId: 123,
			targetClientId: 456
		});

		const email = preview.fieldPlan.find((field) => field.key === 'email');
		const alternativeEmail = preview.fieldPlan.find((field) => field.key === 'alternative_email');

		expect(preview.source.name).toBe('Test Client');
		expect(preview.target.name).toBe('Keeper Client');
		expect(email).toEqual(
			expect.objectContaining({
				keptFrom: 'target',
				keptValue: 'keeper@example.com',
				sourceValue: 'test@example.com'
			})
		);
		expect(alternativeEmail).toEqual(
			expect.objectContaining({
				keptFrom: 'source',
				keptValue: 'alt@example.com'
			})
		);
	});

	it('previews customer merge with target fields kept and empty target fields filled from source', async () => {
		const client = new FakeClient();

		const preview = await getCustomerMergePreview({
			client: client as any,
			sourceCustomerId: 321,
			targetCustomerId: 654
		});

		const email = preview.fieldPlan.find((field) => field.key === 'email');
		const customerNo = preview.fieldPlan.find((field) => field.key === 'customer_no');

		expect(preview.source.name).toBe('Test Customer');
		expect(preview.target.name).toBe('Keeper Customer');
		expect(email).toEqual(
			expect.objectContaining({
				keptFrom: 'target',
				keptValue: 'keeper-customer@example.com',
				sourceValue: 'customer@example.com'
			})
		);
		expect(customerNo).toEqual(
			expect.objectContaining({
				keptFrom: 'source',
				keptValue: 'C-123'
			})
		);
	});

	it('merges client references into the target and deletes source auth access', async () => {
		const client = new FakeClient({
			optionalTables: ['invoice_reminders', 'notes', 'standby_times', 'auth_user', 'auth_session', 'auth_key']
		});

		const result = await mergeClientProfiles({
			client: client as any,
			sourceClientId: 123,
			targetClientId: 456,
			actorUserId: 7
		});

		expect(result.action).toBe('merged');
		expect(result.targetId).toBe(456);
		expect(client.hasSql('UPDATE clients AS target')).toBe(true);
		expect(client.hasSql('UPDATE bookings SET client_id = $1')).toBe(true);
		expect(client.hasSql('UPDATE packages SET client_id = $1')).toBe(true);
		expect(client.hasSql('UPDATE memberships SET client_id = $1')).toBe(true);
		expect(client.hasSql('UPDATE invoice_reminders SET client_id = $1')).toBe(true);
		expect(client.hasSql('UPDATE standby_times SET client_id = $1')).toBe(true);
		expect(client.hasSql('UPDATE notes SET target_id = $1')).toBe(true);
		expect(client.hasSql('DELETE FROM auth_user')).toBe(true);
		expect(mockedReallocateFuturePackageAssignmentsForClient).toHaveBeenCalledWith(
			expect.objectContaining({ clientId: 456, actorUserId: 7 })
		);
	});

	it('merges customer references and reallocates packages for affected clients', async () => {
		const client = new FakeClient({
			optionalTables: ['notes'],
			affectedClientIds: [88, 89]
		});

		const result = await mergeCustomerProfiles({
			client: client as any,
			sourceCustomerId: 321,
			targetCustomerId: 654,
			actorUserId: 7
		});

		expect(result.action).toBe('merged');
		expect(result.targetId).toBe(654);
		expect(client.hasSql('UPDATE customers AS target')).toBe(true);
		expect(client.hasSql('UPDATE packages SET customer_id = $1')).toBe(true);
		expect(client.hasSql('UPDATE memberships SET customer_id = $1')).toBe(true);
		expect(client.hasSql('UPDATE clients SET customer_id = $1')).toBe(true);
		expect(client.hasSql('UPDATE notes SET target_id = $1')).toBe(true);
		expect(client.hasSql('DELETE FROM customers WHERE id')).toBe(true);
		expect(mockedReallocateFuturePackageAssignmentsForClient).toHaveBeenCalledWith(
			expect.objectContaining({ clientId: 88, actorUserId: 7 })
		);
		expect(mockedReallocateFuturePackageAssignmentsForClient).toHaveBeenCalledWith(
			expect.objectContaining({ clientId: 89, actorUserId: 7 })
		);
	});
});
