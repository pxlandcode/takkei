import { error } from '@sveltejs/kit';
import {
	buildClientCalendarSubscriptionLinks,
	getActiveClientCalendarSubscriptionFromToken
} from '$lib/server/clientCalendarSubscriptions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const token = params.token;
	const subscription = token ? await getActiveClientCalendarSubscriptionFromToken(token) : null;

	if (!subscription) {
		throw error(404, 'Kalenderlänken finns inte längre.');
	}

	const links = buildClientCalendarSubscriptionLinks({ origin: url.origin, token });
	const authUser = locals.user;
	const authClientId =
		authUser?.kind === 'client' ? (authUser.clientId ?? authUser.client_id ?? null) : null;

	return {
		...links,
		bookingsPageUrl:
			authClientId === subscription.clientId
				? new URL('/client/bookings', url.origin).toString()
				: links.bookingsPageUrl
	};
};
