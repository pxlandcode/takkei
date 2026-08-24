import { json } from '@sveltejs/kit';
import {
	createOrReuseClientCalendarSubscriptionLinks,
	getClientCalendarActorId,
	resolveClientCalendarPublicOrigin
} from '$lib/server/clientCalendarSubscriptions';

function parseClientId(value: string | undefined): number | null {
	const clientId = Number(value);
	return Number.isInteger(clientId) && clientId > 0 ? clientId : null;
}

export async function POST({ params, request, locals, url }) {
	const clientId = parseClientId(params.slug);
	if (!clientId) {
		return json({ error: 'Ogiltigt klient-id' }, { status: 400 });
	}

	const authUser = locals.user;
	if (!authUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (authUser.kind === 'client') {
		const ownClientId = authUser.clientId ?? null;
		if (ownClientId !== clientId) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}
	}

	const body = await request.json().catch(() => ({}));
	const rotate = body?.rotate === true;

	try {
		const links = await createOrReuseClientCalendarSubscriptionLinks({
			clientId,
			createdByUserId: getClientCalendarActorId(authUser),
			origin: resolveClientCalendarPublicOrigin(url.origin),
			rotate
		});

		return json(links);
	} catch (error) {
		const status = (error as any)?.status;
		if (status === 404) {
			return json({ error: 'Client not found' }, { status: 404 });
		}

		console.error('Failed to create client calendar subscription', error);
		return json({ error: 'Kunde inte skapa kalenderlänk' }, { status: 500 });
	}
}
