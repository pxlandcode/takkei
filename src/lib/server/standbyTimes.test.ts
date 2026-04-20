import { describe, expect, it } from 'vitest';

import {
	canManageStandbyTime,
	canViewStandbyTime,
	findAvailableStandbyStarts,
	standbyTimeMatchesFreedSlot,
	stockholmLocalDateTimeToUtcDate
} from './standbyTimes';

const stockholmIso = (date: string, time: string) =>
	stockholmLocalDateTimeToUtcDate(date, time).toISOString();

describe('stockholmLocalDateTimeToUtcDate', () => {
	it('converts winter Stockholm wall time to UTC', () => {
		expect(stockholmIso('2026-01-15', '10:30')).toBe('2026-01-15T09:30:00.000Z');
	});

	it('converts summer Stockholm wall time to UTC', () => {
		expect(stockholmIso('2026-07-15', '10:30')).toBe('2026-07-15T08:30:00.000Z');
	});

	it('handles DST transition dates consistently', () => {
		expect(stockholmIso('2026-03-29', '03:30')).toBe('2026-03-29T01:30:00.000Z');
		expect(stockholmIso('2026-10-25', '02:30')).toBe('2026-10-25T00:30:00.000Z');
	});
});

describe('standby auth helpers', () => {
	it('lets owners and listed trainers view a standby time', () => {
		expect(canViewStandbyTime(12, { trainer_id: 12, trainer_ids: [44] })).toBe(true);
		expect(canViewStandbyTime(44, { trainer_id: 12, trainer_ids: [44] })).toBe(true);
		expect(canViewStandbyTime(99, { trainer_id: 12, trainer_ids: [44] })).toBe(false);
	});

	it('only lets the owner manage a standby time', () => {
		expect(canManageStandbyTime(12, { trainer_id: 12 })).toBe(true);
		expect(canManageStandbyTime(44, { trainer_id: 12 })).toBe(false);
	});
});

describe('standbyTimeMatchesFreedSlot', () => {
	it('matches by same day, location and start window only', () => {
		const wantedStart = stockholmIso('2026-04-18', '15:00');
		const wantedEnd = stockholmIso('2026-04-18', '17:00');
		const freedStart = stockholmIso('2026-04-18', '16:30');

		expect(
			standbyTimeMatchesFreedSlot(
				{
					location_ids: [68, 71],
					wanted_start_time: wantedStart,
					wanted_end_time: wantedEnd
				},
				68,
				freedStart
			)
		).toBe(true);

		expect(
			standbyTimeMatchesFreedSlot(
				{
					location_ids: [68, 71],
					wanted_start_time: wantedStart,
					wanted_end_time: wantedEnd
				},
				70,
				freedStart
			)
		).toBe(false);

		expect(
			standbyTimeMatchesFreedSlot(
				{
					location_ids: [68, 71],
					wanted_start_time: wantedStart,
					wanted_end_time: wantedEnd
				},
				68,
				stockholmIso('2026-04-19', '16:30')
			)
		).toBe(false);
	});
});

describe('findAvailableStandbyStarts', () => {
	it('returns full-hour starts when only full-hour rooms exist', () => {
		const results = findAvailableStandbyStarts({
			locations: [{ id: 67, name: 'Tegnérgatan', color: null }],
			rooms: [{ id: 1, locationId: 67, halfHourStart: false, active: true }],
			bookings: [],
			unavailableRooms: [],
			wantedStartTime: stockholmIso('2026-04-18', '15:00'),
			wantedEndTime: stockholmIso('2026-04-18', '17:00')
		});

		expect(results.map((result) => result.time)).toEqual(['15:00', '16:00', '17:00']);
	});

	it('shifts to half-hour starts when the location only supports half-hour rooms', () => {
		const results = findAvailableStandbyStarts({
			locations: [{ id: 70, name: 'Nybrokajen', color: null }],
			rooms: [{ id: 2, locationId: 70, halfHourStart: true, active: true }],
			bookings: [],
			unavailableRooms: [],
			wantedStartTime: stockholmIso('2026-04-18', '15:00'),
			wantedEndTime: stockholmIso('2026-04-18', '16:30')
		});

		expect(results.map((result) => result.time)).toEqual(['15:30', '16:30']);
	});

	it('respects bookings, cancelled statuses and unavailable rooms', () => {
		const results = findAvailableStandbyStarts({
			locations: [{ id: 69, name: 'Karlaplan', color: null }],
			rooms: [
				{ id: 11, locationId: 69, halfHourStart: false, active: true },
				{ id: 12, locationId: 69, halfHourStart: true, active: true }
			],
			bookings: [
				{ roomId: 11, startTime: stockholmIso('2026-04-18', '15:00'), status: 'New' },
				{ roomId: 11, startTime: stockholmIso('2026-04-18', '16:00'), status: 'Cancelled' }
			],
			unavailableRooms: [
				{
					roomId: 12,
					startTime: stockholmIso('2026-04-18', '15:00'),
					endTime: stockholmIso('2026-04-18', '16:30')
				}
			],
			wantedStartTime: stockholmIso('2026-04-18', '15:00'),
			wantedEndTime: stockholmIso('2026-04-18', '16:30')
		});

		expect(results.map((result) => result.time)).toEqual(['16:00', '16:30']);
	});
});
