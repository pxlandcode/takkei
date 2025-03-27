import { writable } from 'svelte/store';

export type Customer = {
	id: number;
	name: string;
	email: string;
	phone: string;
	active: boolean;
	customer_no?: string;
	organization_number?: string;
	invoice_reference?: string | null;
};

export const customers = writable<Customer[]>([]);

export async function fetchCustomers() {
	try {
		const res = await fetch('/api/customers');
		if (!res.ok) throw new Error('Failed to fetch customers');

		const data = await res.json();

		const formatted: Customer[] = data.map((customer: any) => ({
			id: customer.id,
			name: customer.name,
			email: customer.email,
			phone: customer.phone,
			active: customer.active,
			customer_no: customer.customer_no,
			organization_number: customer.organization_number,
			invoice_reference: customer.invoice_reference
		}));

		customers.set(formatted);
	} catch (error) {
		console.error('Error fetching customers:', error);
	}
}

export async function fetchCustomersPaginated(limit = 50, offset = 0) {
	try {
		const res = await fetch(`/api/customers?limit=${limit}&offset=${offset}`);
		if (!res.ok) throw new Error('Failed to fetch customers');

		const data = await res.json();

		const formatted: Customer[] = data.map((customer: any) => ({
			id: customer.id,
			name: customer.name,
			email: customer.email,
			phone: customer.phone,
			active: customer.active,
			customer_no: customer.customer_no,
			organization_number: customer.organization_number,
			invoice_reference: customer.invoice_reference
		}));

		return formatted;
	} catch (error) {
		console.error('Error fetching customers:', error);
		return [];
	}
}
