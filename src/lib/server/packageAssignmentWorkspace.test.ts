import { describe, expect, it } from 'vitest';
import {
	isAssignmentBookingRelevant,
	validatePackageAssignmentChanges,
	type PackageAssignmentBooking,
	type PackageAssignmentPackage
} from '$lib/server/packageAssignmentWorkspace';

function makePackage(overrides: Partial<PackageAssignmentPackage> = {}): PackageAssignmentPackage {
	return {
		id: 1,
		customer_id: 10,
		customer_name: 'Kund',
		client_id: null,
		client_name: null,
		article_id: 100,
		article_name: '10-klippkort',
		autogiro: false,
		frozen_from_date: null,
		invoice_numbers: [],
		first_payment_date: '2026-01-01',
		validity_start_date: null,
		validity_end_date: null,
		total_sessions: 10,
		used_sessions_total: 0,
		remaining_sessions: 10,
		is_personal: false,
		is_shared: true,
		label: '10-klippkort - Kund',
		...overrides
	};
}

function makeBooking(overrides: Partial<PackageAssignmentBooking> = {}): PackageAssignmentBooking {
	return {
		id: 1,
		start_time: '2026-03-10T09:00:00.000Z',
		booking_date: '2026-03-10',
		status: 'New',
		client_id: 50,
		client_name: 'Test Klient',
		trainer_name: 'Trainer',
		location_name: 'Studio',
		current_package_id: null,
		current_package_customer_id: null,
		current_package_label: null,
		added_to_package_date: null,
		internal_education: false,
		package_status: 'missing',
		...overrides
	};
}

describe('packageAssignmentWorkspace', () => {
	describe('isAssignmentBookingRelevant', () => {
		it('includes late cancelled bookings but excludes cancelled and package-free ones', () => {
			expect(
				isAssignmentBookingRelevant({
					status: 'Late_cancelled',
					client_id: 1,
					internal: false,
					education: false,
					try_out: false
				})
			).toBe(true);

			expect(
				isAssignmentBookingRelevant({
					status: 'Cancelled',
					client_id: 1,
					internal: false,
					education: false,
					try_out: false
				})
			).toBe(false);

			expect(
				isAssignmentBookingRelevant({
					status: 'New',
					client_id: 1,
					internal: false,
					education: true,
					try_out: false
				})
			).toBe(false);
		});
	});

	describe('validatePackageAssignmentChanges', () => {
		it('rejects attaching a booking to another clients personal package', () => {
			const packages = [makePackage({ id: 11, client_id: 99, client_name: 'Annan klient', is_personal: true, is_shared: false })];
			const bookings = [makeBooking()];

			const result = validatePackageAssignmentChanges({
				packages,
				bookings,
				changes: [{ bookingId: 1, targetPackageId: 11 }]
			});

			expect(result.ok).toBe(false);
			expect(result.rows[0]?.reason).toContain('personligt paket');
		});

		it('rejects moves that would overfill the target package in the projected final state', () => {
			const packages = [makePackage({ id: 20, total_sessions: 2, used_sessions_total: 1, remaining_sessions: 1 })];
			const bookings = [makeBooking({ id: 1 }), makeBooking({ id: 2, client_id: 51, client_name: 'Klient 2' })];

			const result = validatePackageAssignmentChanges({
				packages,
				bookings,
				changes: [
					{ bookingId: 1, targetPackageId: 20 },
					{ bookingId: 2, targetPackageId: 20 }
				]
			});

			expect(result.ok).toBe(false);
			expect(result.rows.some((row) => row.reason?.includes('tillräckligt saldo'))).toBe(true);
		});

		it('allows moving one booking off and another onto the same package when final usage fits', () => {
			const packages = [
				makePackage({ id: 30, total_sessions: 2, used_sessions_total: 2, remaining_sessions: 0 }),
				makePackage({ id: 31, total_sessions: 2, used_sessions_total: 1, remaining_sessions: 1 })
			];
			const bookings = [
				makeBooking({ id: 1, current_package_id: 30, current_package_customer_id: 10, current_package_label: 'A', package_status: 'linked' }),
				makeBooking({ id: 2, current_package_id: 31, current_package_customer_id: 10, current_package_label: 'B', package_status: 'linked' })
			];

			const result = validatePackageAssignmentChanges({
				packages,
				bookings,
				changes: [
					{ bookingId: 1, targetPackageId: 31 },
					{ bookingId: 2, targetPackageId: null }
				]
			});

			expect(result.ok).toBe(true);
			expect(result.effectiveChanges).toHaveLength(2);
		});

		it('rejects packages that are frozen or outside validity for the booking date', () => {
			const bookings = [makeBooking({ id: 1, booking_date: '2026-03-10' })];
			const frozenPackage = makePackage({ id: 41, frozen_from_date: '2026-03-01' });
			const expiredPackage = makePackage({ id: 42, validity_end_date: '2026-03-05' });

			const frozenResult = validatePackageAssignmentChanges({
				packages: [frozenPackage],
				bookings,
				changes: [{ bookingId: 1, targetPackageId: 41 }]
			});
			const expiredResult = validatePackageAssignmentChanges({
				packages: [expiredPackage],
				bookings,
				changes: [{ bookingId: 1, targetPackageId: 42 }]
			});

			expect(frozenResult.ok).toBe(false);
			expect(expiredResult.ok).toBe(false);
			expect(frozenResult.rows[0]?.reason).toContain('giltigt');
			expect(expiredResult.rows[0]?.reason).toContain('giltigt');
		});

		it('treats a move to the same package as a no-op instead of consuming extra capacity', () => {
			const packages = [makePackage({ id: 50, total_sessions: 1, used_sessions_total: 1, remaining_sessions: 0 })];
			const bookings = [
				makeBooking({
					id: 1,
					current_package_id: 50,
					current_package_customer_id: 10,
					current_package_label: '10-klippkort - Kund',
					package_status: 'linked'
				})
			];

			const result = validatePackageAssignmentChanges({
				packages,
				bookings,
				changes: [{ bookingId: 1, targetPackageId: 50 }]
			});

			expect(result.ok).toBe(true);
			expect(result.effectiveChanges).toHaveLength(0);
			expect(result.rows[0]?.changed).toBe(false);
		});
	});
});
