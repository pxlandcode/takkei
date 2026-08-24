import { describe, expect, it } from 'vitest';
import {
	fallbackBookingContentIcon,
	normalizeBookingContentIcon,
	resolveBookingContentIcon
} from '$lib/helpers/bookingContentIcons';
import { mapBookingContentRow, validateBookingContentPayload } from './bookingContents';

describe('booking contents helpers', () => {
	it('validates and normalizes payloads', () => {
		expect(validateBookingContentPayload({ kind: '  Weightlifting  ', icon: 'Training' })).toEqual({
			errors: {},
			values: {
				kind: 'Weightlifting',
				icon: 'Training',
				active: true
			}
		});

		expect(
			validateBookingContentPayload({ kind: '   ', icon: 'Unknown', active: false })
		).toEqual({
			errors: {
				kind: 'Namn krävs',
				icon: 'Välj en giltig ikon'
			},
			values: {
				kind: '',
				icon: 'Training',
				active: false
			}
		});

		expect(validateBookingContentPayload({ kind: 'Löpning', icon: 'Running' }).values.icon).toBe(
			'Running'
		);
	});

	it('maps rows to API shape', () => {
		expect(
			mapBookingContentRow({
				id: '7',
				kind: ' Gymnastics ',
				icon: 'Gymnastics',
				active: true,
				bookings_count: '12',
				created_at: '2026-08-24T10:00:00.000Z',
				updated_at: null
			})
		).toEqual({
			id: 7,
			kind: 'Gymnastics',
			icon: 'Gymnastics',
			active: true,
			bookingsCount: 12,
			createdAt: '2026-08-24T10:00:00.000Z',
			updatedAt: null
		});
	});

	it('resolves configured icons and falls back from old names', () => {
		expect(normalizeBookingContentIcon('Mobility')).toBe('Mobility');
		expect(normalizeBookingContentIcon('Unknown')).toBeNull();
		expect(resolveBookingContentIcon({ icon: 'Gymnastics', kind: 'Anything' })).toBe('Gymnastics');
		expect(resolveBookingContentIcon({ icon: 'Trophy', kind: 'Anything' })).toBe('Trophy');
		expect(fallbackBookingContentIcon('gymnastik')).toBe('Gymnastics');
		expect(fallbackBookingContentIcon('mobilitet')).toBe('Mobility');
		expect(fallbackBookingContentIcon('weightlifting')).toBe('Training');
	});
});
