const PROD_ID = '-//Takkei//Client Bookings//SV';
const ICS_NEWLINE = '\r\n';

export type ClientCalendarEvent = {
	id: number;
	status?: string | null;
	startTime: string | Date;
	endTime?: string | Date | null;
	createdAt?: string | Date | null;
	updatedAt?: string | Date | null;
	locationName?: string | null;
	bookingContentId?: number | null;
	bookingContentKind?: string | null;
};

function toDate(value: string | Date | null | undefined): Date | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function formatICSTimestamp(value: string | Date | null | undefined): string {
	const date = toDate(value) ?? new Date(0);
	return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeICSText(raw: string): string {
	return raw
		.replace(/\\/g, '\\\\')
		.replace(/\r\n/g, '\n')
		.replace(/\n/g, '\\n')
		.replace(/,/g, '\\,')
		.replace(/;/g, '\\;');
}

function isCancelledStatus(status?: string | null): boolean {
	if (!status) return false;
	const normalized = status.toLowerCase();
	return normalized.includes('cancel');
}

function getEventEnd(event: ClientCalendarEvent): Date {
	const start = toDate(event.startTime) ?? new Date(0);
	const end = toDate(event.endTime);
	if (end && end.getTime() > start.getTime()) return end;
	return new Date(start.getTime() + 60 * 60 * 1000);
}

function getEventLastModifiedDate(event: ClientCalendarEvent): Date {
	return (
		toDate(event.updatedAt) ?? toDate(event.createdAt) ?? toDate(event.startTime) ?? new Date(0)
	);
}

function getEventSequence(event: ClientCalendarEvent): number {
	return Math.max(0, Math.floor(getEventLastModifiedDate(event).getTime() / 1000));
}

function buildEventLines(event: ClientCalendarEvent): string[] {
	const cancelled = isCancelledStatus(event.status);
	const lastModified = getEventLastModifiedDate(event);

	return [
		'BEGIN:VEVENT',
		`UID:takkei-client-booking-${event.id}@takkei.se`,
		`DTSTAMP:${formatICSTimestamp(lastModified)}`,
		`LAST-MODIFIED:${formatICSTimestamp(lastModified)}`,
		`SEQUENCE:${getEventSequence(event)}`,
		`SUMMARY:${escapeICSText(cancelled ? 'Avbokad - Takkei' : 'Takkei - Träning')}`,
		`DTSTART:${formatICSTimestamp(event.startTime)}`,
		`DTEND:${formatICSTimestamp(getEventEnd(event))}`,
		event.locationName?.trim() ? `LOCATION:${escapeICSText(event.locationName.trim())}` : null,
		`STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
		'TRANSP:OPAQUE',
		'END:VEVENT'
	].filter(Boolean) as string[];
}

export function getClientCalendarLastModified(
	events: ClientCalendarEvent[],
	fallback?: string | Date | null
): Date {
	const fallbackDate = toDate(fallback) ?? new Date(0);
	return events.reduce((latest, event) => {
		const candidate = getEventLastModifiedDate(event);
		return candidate.getTime() > latest.getTime() ? candidate : latest;
	}, fallbackDate);
}

export function buildClientCalendarICS(events: ClientCalendarEvent[]): string {
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		`PRODID:${PROD_ID}`,
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'X-WR-CALNAME:Takkei - Mina bokningar',
		'X-WR-CALDESC:Takkei bokningar'
	];

	for (const event of events) {
		lines.push(...buildEventLines(event));
	}

	lines.push('END:VCALENDAR');

	return lines.join(ICS_NEWLINE);
}
