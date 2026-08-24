import { describe, expect, it } from 'vitest';
import {
	fallbackCancellationReasonOptions,
	getCancellationReasonLabel
} from '$lib/helpers/bookingHelpers/cancellation';
import {
	createCancellationReasonValue,
	mapCancellationReasonRow,
	validateCancellationReasonPayload
} from './cancellationReasons';

describe('cancellation reason helpers', () => {
	it('validates and normalizes payloads', () => {
		expect(validateCancellationReasonPayload({ label: '  Familj  ' })).toEqual({
			errors: {},
			values: {
				label: 'Familj',
				active: true
			}
		});

		expect(validateCancellationReasonPayload({ label: '   ', active: false })).toEqual({
			errors: {
				label: 'Orsak krävs'
			},
			values: {
				label: '',
				active: false
			}
		});
	});

	it('maps rows and creates stable values from labels', () => {
		expect(createCancellationReasonValue(' Vård av barn ')).toBe('Vard_av_barn');
		expect(createCancellationReasonValue('***')).toBe('Reason');

		expect(
			mapCancellationReasonRow({
				id: '7',
				value: 'Family',
				label: ' Familj ',
				active: true,
				bookings_count: '12',
				created_at: '2026-08-24T10:00:00.000Z',
				updated_at: null
			})
		).toEqual({
			id: 7,
			value: 'Family',
			label: 'Familj',
			active: true,
			bookingsCount: 12,
			createdAt: '2026-08-24T10:00:00.000Z',
			updatedAt: null
		});
	});

	it('displays configured labels with hardcoded fallback for old values', () => {
		expect(getCancellationReasonLabel('Family', [{ value: 'Family', label: 'Familjeskäl' }])).toBe(
			'Familjeskäl'
		);
		expect(getCancellationReasonLabel('Travel', [])).toBe('Resa');
		expect(getCancellationReasonLabel('Custom reason', fallbackCancellationReasonOptions)).toBe(
			'Custom reason'
		);
	});
});
