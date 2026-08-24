import { describe, expect, it } from 'vitest';
import { buildClientCalendarICS, getClientCalendarLastModified } from './client-calendar-ics';

describe('client calendar ICS', () => {
	it('builds minimal confirmed booking events', () => {
		const updatedAt = '2026-01-02T03:04:05.000Z';
		const ics = buildClientCalendarICS([
			{
				id: 123,
				status: 'New',
				startTime: '2026-02-03T10:00:00.000Z',
				endTime: '2026-02-03T11:00:00.000Z',
				updatedAt,
				locationName: 'Stockholm Studio'
			}
		]);

		expect(ics).toContain('BEGIN:VCALENDAR');
		expect(ics).toContain('UID:takkei-client-booking-123@takkei.se');
		expect(ics).toContain(`SEQUENCE:${Math.floor(new Date(updatedAt).getTime() / 1000)}`);
		expect(ics).toContain('SUMMARY:Takkei - Träning');
		expect(ics).toContain('DTSTART:20260203T100000Z');
		expect(ics).toContain('DTEND:20260203T110000Z');
		expect(ics).toContain('LOCATION:Stockholm Studio');
		expect(ics).toContain('STATUS:CONFIRMED');
		expect(ics).not.toContain('DESCRIPTION:');
		expect(ics).not.toContain('person_number');
		expect(ics).not.toContain('@example.com');
	});

	it('keeps stable UIDs and marks cancelled bookings', () => {
		const ics = buildClientCalendarICS([
			{
				id: 555,
				status: 'Cancelled',
				startTime: '2026-05-01T08:00:00.000Z',
				endTime: '2026-05-01T09:00:00.000Z',
				updatedAt: '2026-04-30T12:00:00.000Z'
			}
		]);

		expect(ics).toContain('UID:takkei-client-booking-555@takkei.se');
		expect(ics).toContain('SUMMARY:Avbokad - Takkei');
		expect(ics).toContain('STATUS:CANCELLED');
	});

	it('uses the latest event update as the feed last-modified value', () => {
		const lastModified = getClientCalendarLastModified(
			[
				{ id: 1, startTime: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T09:00:00.000Z' },
				{ id: 2, startTime: '2026-01-02T10:00:00.000Z', updatedAt: '2026-01-03T09:00:00.000Z' }
			],
			'2025-12-31T00:00:00.000Z'
		);

		expect(lastModified.toISOString()).toBe('2026-01-03T09:00:00.000Z');
	});
});
