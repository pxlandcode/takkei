import { describe, expect, it } from 'vitest';
import { buildMeetingConfirmationEmailBody } from './bookingHelpers';

describe('bookingHelpers meeting email', () => {
	it('renders all meeting fields except attendees', () => {
		const html = buildMeetingConfirmationEmailBody({
			name: 'Planeringsmöte',
			text: 'Gå igenom höstens upplägg',
			bookedDates: [{ date: '2026-09-02', time: '10:00', endTime: '11:00' }],
			fromUser: { firstname: 'Anna', lastname: 'Andersson', email: 'anna@example.com' }
		});

		expect(html).toContain('Planeringsmöte');
		expect(html).toContain('Gå igenom höstens upplägg');
		expect(html).toContain('2026-09-02 kl. 10:00 - 11:00');
		expect(html).toContain('Bokad av:</strong> Anna Andersson');
		expect(html).not.toContain('Deltagare');
	});

	it('escapes user-provided meeting content', () => {
		const html = buildMeetingConfirmationEmailBody({
			name: '<script>alert("namn")</script>',
			text: 'Rad ett\n<strong>Rad två</strong>',
			bookedDates: [{ date: '2026-09-03', time: '12:00', endTime: '12:30' }],
			fromUser: { firstname: 'Ola', lastname: '<Admin>', email: 'ola@example.com' }
		});

		expect(html).toContain('&lt;script&gt;alert(&quot;namn&quot;)&lt;/script&gt;');
		expect(html).toContain('Rad ett<br>&lt;strong&gt;Rad två&lt;/strong&gt;');
		expect(html).toContain('Ola &lt;Admin&gt;');
		expect(html).not.toContain('<script>alert("namn")</script>');
		expect(html).not.toContain('<strong>Rad två</strong>');
	});

	it('renders repeated meeting times with individual end times', () => {
		const html = buildMeetingConfirmationEmailBody({
			name: 'Veckomöte',
			text: null,
			bookedDates: [
				{ date: '2026-09-07', time: '09:00', endTime: '10:00' },
				{ date: '2026-09-14', time: '09:30', endTime: '10:30' }
			],
			fromUser: { firstname: 'Sara', lastname: 'Svensson', email: 'sara@example.com' }
		});

		expect(html).toContain('2026-09-07 kl. 09:00 - 10:00');
		expect(html).toContain('2026-09-14 kl. 09:30 - 10:30');
		expect(html).toContain('Ingen beskrivning angiven.');
	});
});
