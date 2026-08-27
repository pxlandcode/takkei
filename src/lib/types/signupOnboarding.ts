export type SignupOnboardingStatus = 'new' | 'in_progress' | 'waiting' | 'completed' | 'cancelled';

export type SignupOnboardingActionInput =
	| {
			type: 'update_details';
			details: {
				firstname: string;
				lastname: string;
				email: string;
				person_number: string;
				phone: string;
				streetAddress: string;
				zip: string;
				city: string;
			};
	  }
	| { type: 'confirm_new_client' }
	| { type: 'merge_client'; targetClientId: number }
	| { type: 'keep_customer' }
	| { type: 'merge_customer'; targetCustomerId: number }
	| { type: 'connect_customer'; targetCustomerId: number }
	| { type: 'keep_package' }
	| { type: 'connect_package'; packageId: number }
	| { type: 'skip_package' }
	| { type: 'set_primary_assignment'; primaryTrainerId: number; primaryLocationId: number }
	| { type: 'skip_primary_assignment' }
	| { type: 'mark_waiting'; note: string }
	| { type: 'reopen' }
	| { type: 'attach_booking'; bookingId: number }
	| { type: 'complete'; note?: string }
	| { type: 'cancel'; note?: string };

export type SignupOnboardingAction = SignupOnboardingActionInput & {
	expectedUpdatedAt: string;
};

export type SignupOnboardingSummary = {
	pending: number;
};
