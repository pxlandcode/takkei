import { error, redirect } from '@sveltejs/kit';
import { fetchBookings } from '$lib/services/api/calendarService';
import type { PageServerLoad } from './$types';

function formatDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export const load: PageServerLoad = async ({ locals, fetch }) => {
	const authUser = locals.user;

	if (!authUser) {
		throw redirect(302, '/login');
	}

	if (authUser.kind !== 'client') {
		throw redirect(303, '/');
	}

	const clientId = authUser.clientId ?? authUser.client_id ?? null;

	if (!clientId) {
		throw redirect(302, '/login');
	}

	const today = new Date();
	const fromDate = new Date(today);
	const toDate = new Date(today);
	fromDate.setFullYear(fromDate.getFullYear() - 1);
	toDate.setFullYear(toDate.getFullYear() + 1);

	const [clientResponse, bookings] = await Promise.all([
		fetch(`/api/clients/${clientId}`),
		fetchBookings(
			{
				from: formatDate(fromDate),
				to: formatDate(toDate),
				clientIds: [clientId],
				sortAsc: true
			},
			fetch,
			undefined,
			0,
			true
		)
	]);

	if (!clientResponse.ok) {
		throw error(clientResponse.status, 'Kunde inte hämta klientprofil.');
	}

	const client = await clientResponse.json();

	return {
		client,
		bookings
	};
};
