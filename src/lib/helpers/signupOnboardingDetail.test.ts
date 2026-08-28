import { describe, expect, it } from 'vitest';
import {
	clientSuggestionReasons,
	customerSuggestionReasons,
	nextRequiredOnboardingStep,
	onboardingRequiredComplete,
	packageAvailabilityOptions
} from './signupOnboardingDetail';

describe('signup onboarding detail helpers', () => {
	it('explains client suggestion reasons from matched fields', () => {
		expect(
			clientSuggestionReasons(
				{
					firstname: 'Anna',
					lastname: 'Andersson',
					email: 'ANNA@example.com',
					phone: '070-123 45 67',
					person_number: '800101-1234'
				},
				{
					firstname: 'anna',
					lastname: 'andersson',
					email: 'anna@example.com',
					phone: '0701234567',
					person_number: '8001011234'
				}
			)
		).toEqual(['Personnummer', 'E-post', 'Telefon', 'Namn']);
	});

	it('explains customer suggestion reasons from matched payer fields', () => {
		expect(
			customerSuggestionReasons(
				{
					payerName: 'Acme AB',
					payerEmail: 'billing@example.com',
					payerPhone: '08-123 456',
					payerOrganizationNumber: '556677-8899'
				},
				{
					name: 'acme ab',
					email: 'BILLING@example.com',
					phone: '08123456',
					organization_number: '5566778899'
				}
			)
		).toEqual(['Org/personnummer', 'E-post', 'Telefon', 'Namn']);
	});

	it('separates selectable and unavailable packages with reasons', () => {
		const result = packageAvailabilityOptions(
			[
				{
					id: 1,
					article_name: 'PT 10',
					client_id: null,
					total_sessions: 10,
					remaining_sessions: 2,
					is_shared: true
				},
				{
					id: 2,
					article_name: 'Fullt',
					client_id: null,
					total_sessions: 10,
					remaining_sessions: 0,
					is_shared: true
				},
				{
					id: 3,
					article_name: 'Annan klient',
					client_id: 99,
					client_name: 'Annan Klient',
					total_sessions: 10,
					remaining_sessions: 4,
					is_shared: false
				}
			],
			20
		);

		expect(result.selectable.map((option) => option.value)).toEqual([1]);
		expect(result.unavailable).toEqual([
			expect.objectContaining({ value: 2, reasons: ['Fullbokat'] }),
			expect.objectContaining({ value: 3, reasons: ['Personligt för annan klient'] })
		]);
	});

	it('treats required onboarding steps as complete without a booking', () => {
		expect(
			onboardingRequiredComplete({
				client_resolution: 'confirmed_new',
				resolved_client_id: 20,
				customer_resolution: 'kept',
				resolved_customer_id: 30,
				package_resolution: 'not_required',
				resolved_package_id: null,
				primary_assignment_resolution: 'skipped',
				booking_id: null
			})
		).toBe(true);
	});

	it('finds the next required onboarding step', () => {
		const completeCase = {
			client_resolution: 'confirmed_new',
			resolved_client_id: 20,
			customer_resolution: 'kept',
			resolved_customer_id: 30,
			package_resolution: 'connected',
			resolved_package_id: 40,
			primary_assignment_resolution: 'selected'
		};

		expect(nextRequiredOnboardingStep({ ...completeCase, client_resolution: 'pending' })).toBe(
			'client'
		);
		expect(nextRequiredOnboardingStep({ ...completeCase, customer_resolution: 'pending' })).toBe(
			'customer'
		);
		expect(nextRequiredOnboardingStep({ ...completeCase, package_resolution: 'pending' })).toBe(
			'package'
		);
		expect(
			nextRequiredOnboardingStep({ ...completeCase, primary_assignment_resolution: 'pending' })
		).toBe('primary_assignment');
		expect(nextRequiredOnboardingStep(completeCase)).toBeNull();
	});
});
