import { describe, expect, it } from 'vitest';
import {
	bookingConsumesPackage,
	getNextStockholmDayStartLocal,
	getStockholmYmd,
	isChargeablePackageBookingStatus,
	isPackageUsableOnDate,
	selectActivePackage
} from './packageSemantics';

describe('packageSemantics', () => {
	describe('isChargeablePackageBookingStatus', () => {
		it('treats only Cancelled as non-chargeable', () => {
			expect(isChargeablePackageBookingStatus('Cancelled')).toBe(false);
			expect(isChargeablePackageBookingStatus('Late_cancelled')).toBe(true);
			expect(isChargeablePackageBookingStatus('New')).toBe(true);
			expect(isChargeablePackageBookingStatus(null)).toBe(true);
		});
	});

	describe('bookingConsumesPackage', () => {
		it('excludes internal, education and try-out bookings', () => {
			expect(bookingConsumesPackage({})).toBe(true);
			expect(bookingConsumesPackage({ internal: true })).toBe(false);
			expect(bookingConsumesPackage({ education: true })).toBe(false);
			expect(bookingConsumesPackage({ try_out: true })).toBe(false);
		});

		it('does not exclude internal_education by itself', () => {
			expect(bookingConsumesPackage({ internal_education: true })).toBe(true);
		});
	});

	describe('isPackageUsableOnDate', () => {
		it('applies frozen date and validity boundaries inclusively', () => {
			expect(
				isPackageUsableOnDate(
					{
						frozen_from_date: '2025-02-10',
						validity_start_date: '2025-01-01',
						validity_end_date: '2025-12-31'
					},
					'2025-02-09'
				)
			).toBe(true);

			expect(
				isPackageUsableOnDate(
					{
						frozen_from_date: '2025-02-10',
						validity_start_date: '2025-01-01',
						validity_end_date: '2025-12-31'
					},
					'2025-02-10'
				)
			).toBe(false);

			expect(
				isPackageUsableOnDate(
					{
						validity_start_date: '2025-03-01',
						validity_end_date: '2025-03-31'
					},
					'2025-02-28'
				)
			).toBe(false);

			expect(
				isPackageUsableOnDate(
					{
						validity_start_date: '2025-03-01',
						validity_end_date: '2025-03-31'
					},
					'2025-03-01'
				)
			).toBe(true);

			expect(
				isPackageUsableOnDate(
					{
						validity_start_date: '2025-03-01',
						validity_end_date: '2025-03-31'
					},
					'2025-04-01'
				)
			).toBe(false);
		});
	});

	describe('selectActivePackage', () => {
		it('prefers a valid personal package over a valid shared package', () => {
			const selected = selectActivePackage(
				[
					{
						id: 1,
						is_personal: false,
						is_shared: true,
						remaining_sessions: 10,
						validity_end_date: '2026-12-31'
					},
					{
						id: 2,
						is_personal: true,
						remaining_sessions: 1,
						validity_end_date: '2025-12-31'
					}
				],
				'2025-05-01'
			);

			expect(selected?.id).toBe(2);
		});

		it('falls back to shared when no valid personal package exists', () => {
			const selected = selectActivePackage(
				[
					{
						id: 1,
						is_personal: true,
						remaining_sessions: 0,
						validity_end_date: '2025-12-31'
					},
					{
						id: 2,
						is_personal: false,
						is_shared: true,
						remaining_sessions: 3,
						validity_end_date: '2025-06-30'
					}
				],
				'2025-05-01'
			);

			expect(selected?.id).toBe(2);
		});

		it('ignores frozen and expired packages', () => {
			const selected = selectActivePackage(
				[
					{
						id: 1,
						is_personal: true,
						remaining_sessions: 4,
						frozen_from_date: '2025-05-01'
					},
					{
						id: 2,
						is_personal: true,
						remaining_sessions: 4,
						validity_end_date: '2025-04-30'
					},
					{
						id: 3,
						is_personal: false,
						is_shared: true,
						remaining_sessions: 2,
						validity_end_date: '2025-05-31'
					}
				],
				'2025-05-01'
			);

			expect(selected?.id).toBe(3);
		});

		it('prefers latest defined validity end date among same priority candidates', () => {
			const selected = selectActivePackage(
				[
					{
						id: 1,
						is_personal: true,
						remaining_sessions: 1,
						validity_end_date: '2025-06-01',
						first_payment_date: '2025-01-01'
					},
					{
						id: 2,
						is_personal: true,
						remaining_sessions: 1,
						validity_end_date: '2025-09-01',
						first_payment_date: '2025-02-01'
					},
					{
						id: 3,
						is_personal: true,
						remaining_sessions: 1,
						validity_end_date: null,
						first_payment_date: '2024-12-01'
					}
				],
				'2025-05-01'
			);

			expect(selected?.id).toBe(2);
		});

		it('uses first payment date then id as deterministic fallback', () => {
			const selected = selectActivePackage(
				[
					{
						id: 20,
						is_personal: true,
						remaining_sessions: 1,
						first_payment_date: '2025-02-01'
					},
					{
						id: 10,
						is_personal: true,
						remaining_sessions: 1,
						first_payment_date: '2025-01-01'
					},
					{
						id: 11,
						is_personal: true,
						remaining_sessions: 1,
						first_payment_date: '2025-01-01'
					}
				],
				'2025-05-01'
			);

			expect(selected?.id).toBe(10);
		});
	});

	describe('Stockholm day cutoff helpers', () => {
		it('returns the next Stockholm day start as an exclusive cutoff', () => {
			const lateSameDay = new Date('2025-01-10T22:30:00Z'); // 23:30 Stockholm (winter)
			const nextLocalStart = getNextStockholmDayStartLocal(lateSameDay);
			expect(getStockholmYmd(lateSameDay)).toBe('2025-01-10');
			expect(nextLocalStart).toBe('2025-01-11 00:00:00');

			const afterMidnightStockholm = new Date('2025-01-10T23:30:00Z'); // 00:30 Stockholm next day
			expect(getStockholmYmd(afterMidnightStockholm)).toBe('2025-01-11');
		});
	});
});

