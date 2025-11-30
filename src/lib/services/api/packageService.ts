import type { Package, NewPackagePayload } from '$lib/types/packageTypes';

export async function getPackages(): Promise<Package[]> {
	const res = await fetch('/api/packages');
	if (!res.ok) throw new Error('Failed to fetch packages');
	return res.json();
}

export async function getPackageById(id: number): Promise<Package> {
	const res = await fetch(`/api/packages/${id}`);
	if (!res.ok) throw new Error('Failed to fetch package');
	return res.json();
}

export async function createPackage(payload: NewPackagePayload): Promise<{ id: number }> {
        const res = await fetch('/api/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
        });
	if (!res.ok) throw new Error('Failed to create package');
	return res.json();
}

export async function updatePackage(id: number, payload: NewPackagePayload): Promise<{ id: number }> {
	const res = await fetch(`/api/packages/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (!res.ok) throw new Error('Failed to update package');
	return res.json();
}

export async function getArticles() {
	const res = await fetch('/api/articles');
	if (!res.ok) throw new Error('Failed to fetch articles');
	return res.json();
}

export async function getClientsForCustomer(customerId: number) {
	const res = await fetch(`/api/clients?customerId=${customerId}`);
	if (!res.ok) throw new Error('Failed to fetch clients');
	return res.json();
}
