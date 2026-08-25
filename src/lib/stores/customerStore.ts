import { writable } from 'svelte/store';
import { cacheFirstJson, wrapFetch } from '$lib/services/api/apiCache';

export type Customer = {
	id: number;
	name: string;
	email: string;
	phone: string;
	active: boolean;
	gdpr_deleted_at?: string | null;
	gdpr_delete_token?: string | null;
	merged_into_customer_id?: number | null;
	customer_no?: string;
	organization_number?: string;
	invoice_reference?: string | null;
};

export const customers = writable<Customer[]>([]);

function formatCustomers(data: any[]): Customer[] {
	return data.map((customer: any) => ({
		id: customer.id,
		name: customer.name,
		email: customer.email,
		phone: customer.phone,
		active: customer.active,
		gdpr_deleted_at: customer.gdpr_deleted_at ?? null,
		gdpr_delete_token: customer.gdpr_delete_token ?? null,
		merged_into_customer_id: customer.merged_into_customer_id ?? null,
		customer_no: customer.customer_no,
		organization_number: customer.organization_number,
		invoice_reference: customer.invoice_reference
	}));
}

export async function fetchCustomers() {
	try {
		const { cached, fresh } = cacheFirstJson<any[]>(fetch, '/api/customers');
		if (cached) customers.set(formatCustomers(cached));

		const data = await fresh;
		customers.set(formatCustomers(data));
	} catch (error) {
		console.error('Error fetching customers:', error);
	}
}

export async function fetchCustomersPaginated(limit = 50, offset = 0) {
	try {
		const res = await wrapFetch(fetch)(`/api/customers?limit=${limit}&offset=${offset}`);
		if (!res.ok) throw new Error('Failed to fetch customers');

		const data = await res.json();
		return formatCustomers(data);
	} catch (error) {
		console.error('Error fetching customers:', error);
		return [];
	}
}
