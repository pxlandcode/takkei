import { invalidateByPrefix, wrapFetch } from '$lib/services/api/apiCache';

const base = '/api/locations';

export async function getLocations() {
	const res = await wrapFetch(fetch)(base);
	if (!res.ok) throw new Error('Failed to fetch locations');
	return await res.json();
}

export async function updateLocation(id: number, data: { name?: string; color?: string }) {
	const res = await fetch(`${base}/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	});
	if (!res.ok) throw new Error('Failed to update location');
	invalidateByPrefix(base);
	return await res.json();
}

export async function createLocation(data: { name: string; color: string }) {
	const res = await fetch(base, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	});
	if (!res.ok) throw new Error('Failed to create location');
	invalidateByPrefix(base);
	return await res.json();
}
