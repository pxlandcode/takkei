import { describe, expect, it } from 'vitest';

import { findTravelConflictForBooking } from './bookingTravelConflict';

describe('findTravelConflictForBooking', () => {
	it('flags back-to-back bookings on different locations', () => {
		const conflict = findTravelConflictForBooking({
			targetStartTime: '2026-04-30T14:30:00Z',
			targetLocationId: 69,
			bookings: [{ id: 30825, start_time: '2026-04-30T13:30:00Z', location_id: 70 }]
		});

		expect(conflict).toEqual({
			conflictingBookingId: 30825,
			conflictingStartTime: '2026-04-30T13:30:00Z',
			conflictingLocationId: 70
		});
	});

	it('allows adjacent bookings on the same location', () => {
		const conflict = findTravelConflictForBooking({
			targetStartTime: '2026-04-30T14:30:00Z',
			targetLocationId: 69,
			bookings: [{ id: 30825, start_time: '2026-04-30T13:30:00Z', location_id: 69 }]
		});

		expect(conflict).toBeNull();
	});

	it('allows a 25 minute travel gap between different locations', () => {
		const conflict = findTravelConflictForBooking({
			targetStartTime: '2026-04-30T14:55:00Z',
			targetLocationId: 69,
			bookings: [{ id: 30825, start_time: '2026-04-30T13:30:00Z', location_id: 70 }]
		});

		expect(conflict).toBeNull();
	});

	it('allows a Stockholm-local booking one hour before a later booking on another location', () => {
		const conflict = findTravelConflictForBooking({
			targetStartTime: '2026-03-26T09:30:00',
			targetLocationId: 68,
			bookings: [{ id: 27655, start_time: '2026-03-26T10:30:00.000Z', location_id: 71 }]
		});

		expect(conflict).toBeNull();
	});
});
