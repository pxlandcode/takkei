import { createHash } from 'crypto';
import {
	buildClientCalendarICS,
	getClientCalendarLastModified
} from '$lib/helpers/calendarHelpers/client-calendar-ics';
import {
	getActiveClientCalendarSubscriptionFromToken,
	getClientCalendarFeedEvents,
	markClientCalendarSubscriptionAccessed
} from '$lib/server/clientCalendarSubscriptions';

function buildEtag(body: string): string {
	return `"${createHash('sha1').update(body).digest('hex')}"`;
}

function isNotModified(request: Request, etag: string, lastModified: Date): boolean {
	if (request.headers.get('if-none-match') === etag) return true;

	const rawIfModifiedSince = request.headers.get('if-modified-since');
	if (!rawIfModifiedSince) return false;

	const ifModifiedSince = new Date(rawIfModifiedSince);
	if (Number.isNaN(ifModifiedSince.getTime())) return false;

	return lastModified.getTime() <= ifModifiedSince.getTime();
}

export async function GET({ params, request }) {
	const token = params.token;
	if (!token) {
		return new Response('Not found', { status: 404 });
	}

	try {
		const subscription = await getActiveClientCalendarSubscriptionFromToken(token);
		if (!subscription) {
			return new Response('Not found', { status: 404 });
		}

		const events = await getClientCalendarFeedEvents(subscription.clientId);
		const body = buildClientCalendarICS(events);
		const etag = buildEtag(body);
		const lastModified = getClientCalendarLastModified(events, subscription.createdAt);
		const headers = new Headers({
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': 'inline; filename="takkei-bokningar.ics"',
			'Cache-Control': 'private, max-age=300, must-revalidate',
			ETag: etag,
			'Last-Modified': lastModified.toUTCString()
		});

		await markClientCalendarSubscriptionAccessed(subscription.id);

		if (isNotModified(request, etag, lastModified)) {
			return new Response(null, { status: 304, headers });
		}

		return new Response(body, { status: 200, headers });
	} catch (error) {
		console.error('Failed to serve client calendar feed', error);
		return new Response('Internal Server Error', { status: 500 });
	}
}
