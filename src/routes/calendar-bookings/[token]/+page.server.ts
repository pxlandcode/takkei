import { error } from '@sveltejs/kit';
import {
	buildClientCalendarSubscriptionLinks,
	getActiveClientCalendarSubscriptionFromToken,
	getClientCalendarFeedEvents
} from '$lib/server/clientCalendarSubscriptions';
import type { FullBooking } from '$lib/types/calendarTypes';
import type { PageServerLoad } from './$types';

function toIso(value: string | Date | null | undefined): string | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isCancelledStatus(status?: string | null): boolean {
	if (!status) return false;
	return status.toLowerCase().includes('cancel');
}

function toPublicBooking(
	event: Awaited<ReturnType<typeof getClientCalendarFeedEvents>>[number]
): FullBooking {
	const startTime = toIso(event.startTime) ?? new Date(0).toISOString();
	const updatedAt = toIso(event.updatedAt) ?? toIso(event.createdAt) ?? startTime;
	const status = isCancelledStatus(event.status) ? 'Cancelled' : 'New';
	const locationName = event.locationName?.trim() || null;
	const bookingContentKind = event.bookingContentKind?.trim() || 'Bokning';
	const bookingContentId = event.bookingContentId ?? 0;

	return {
		isPersonalBooking: false,
		booking: {
			id: event.id,
			status,
			createdAt: toIso(event.createdAt) ?? updatedAt,
			updatedAt,
			startTime,
			endTime: toIso(event.endTime),
			tryOut: false,
			bookingWithoutRoom: false,
			internalEducation: false
		},
		trainer: null,
		client: null,
		trainee: null,
		room: null,
		location: locationName
			? {
					id: 0,
					name: locationName,
					color: '#dd890b'
				}
			: null,
		additionalInfo: {
			education: false,
			internal: false,
			bookingContent: {
				id: bookingContentId,
				kind: bookingContentKind
			}
		},
		personalBooking: null
	};
}

export const load: PageServerLoad = async ({ params, url }) => {
	const token = params.token;
	const subscription = token ? await getActiveClientCalendarSubscriptionFromToken(token) : null;

	if (!subscription) {
		throw error(404, 'Bokningslänken finns inte längre.');
	}

	const events = await getClientCalendarFeedEvents(subscription.clientId);
	const links = buildClientCalendarSubscriptionLinks({ origin: url.origin, token });

	return {
		syncPageUrl: links.syncPageUrl,
		bookings: events.map(toPublicBooking)
	};
};
