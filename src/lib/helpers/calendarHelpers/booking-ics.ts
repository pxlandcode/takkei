import type { FullBooking } from '$lib/types/calendarTypes';

const PROD_ID = '-//Takkei//Bookings//SV';
const ICS_NEWLINE = '\r\n';

function ensureBookingEnd(booking: FullBooking): string {
	if (booking.booking.endTime) return booking.booking.endTime;
	const start = new Date(booking.booking.startTime);
	if (Number.isNaN(start.getTime())) {
		return new Date().toISOString();
	}
	start.setHours(start.getHours() + 1);
	return start.toISOString();
}

function formatICSTimestamp(value: string | Date): string {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
	}
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

function buildSummary() {
	return 'Takkei - Träning';
}

function buildDescription(booking: FullBooking): string {
	const parts = [
		booking.trainer
			? `Tränare: ${booking.trainer.firstname} ${booking.trainer.lastname}`
			: null,
		booking.location?.name ? `Plats: ${booking.location.name}` : null,
		booking.personalBooking?.text ? booking.personalBooking.text : null
	].filter(Boolean);

	return parts.join('\n');
}

function mapToICSStatus(status?: string | null): string {
	if (!status) return 'CONFIRMED';
	const lowered = status.toLowerCase();
	if (lowered.includes('cancel')) return 'CANCELLED';
	return 'CONFIRMED';
}

function buildEventLines(booking: FullBooking): string[] {
	const start = formatICSTimestamp(booking.booking.startTime);
	const end = formatICSTimestamp(ensureBookingEnd(booking));
	const summary = buildSummary();
	const description = buildDescription(booking);

	return [
		'BEGIN:VEVENT',
		`UID:booking-${booking.booking.id}@takkei.app`,
		`DTSTAMP:${formatICSTimestamp(new Date())}`,
		`SUMMARY:${escapeICSText(summary)}`,
		`DTSTART:${start}`,
		`DTEND:${end}`,
		booking.location?.name ? `LOCATION:${escapeICSText(booking.location.name)}` : null,
		description ? `DESCRIPTION:${escapeICSText(description)}` : null,
		`STATUS:${mapToICSStatus(booking.booking.status)}`,
		'END:VEVENT'
	].filter(Boolean) as string[];
}

export function buildBookingsICS(bookings: FullBooking[]): string {
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		`PRODID:${PROD_ID}`,
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'X-WR-CALNAME:Takkei - Träning'
	];

	bookings.forEach((booking) => {
		lines.push(...buildEventLines(booking));
	});

	lines.push('END:VCALENDAR');

	return lines.join(ICS_NEWLINE);
}

export function downloadBookingsAsICS(bookings: FullBooking[], filename: string) {
	if (bookings.length === 0) return;
	if (typeof document === 'undefined' || typeof window === 'undefined') return;

	const safeName = filename && filename.trim().length ? filename.trim() : 'takkei-bokningar';
	const icsPayload = buildBookingsICS(bookings);
	const blob = new Blob([icsPayload], { type: 'text/calendar;charset=utf-8' });
	const objectUrl = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = objectUrl;
	link.download = safeName.endsWith('.ics') ? safeName : `${safeName}.ics`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
