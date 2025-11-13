import { writable } from 'svelte/store';

export type SelectedSlotSource = 'training' | 'trial' | 'flight' | 'practice' | 'education';

export type SelectedSlot = {
	source: SelectedSlotSource;
	date: string | null;
	time: string | null;
	trainerId: number | null;
	locationId: number | null;
	clientId?: number | null;
	traineeId?: number | null;
	bookingType?: { label: string; value: string | number } | null;
	trainerName?: string | null;
	trainerFirstName?: string | null;
	trainerLastName?: string | null;
	clientName?: string | null;
	clientFirstName?: string | null;
	clientLastName?: string | null;
	traineeName?: string | null;
	traineeFirstName?: string | null;
	traineeLastName?: string | null;
	locationName?: string | null;
	locationColor?: string | null;
	createdAt: number;
};

type WritableSelectedSlot = Omit<SelectedSlot, 'createdAt'>;

export const selectedSlot = writable<SelectedSlot | null>(null);

export function setSelectedSlot(slot: WritableSelectedSlot): void {
	selectedSlot.set({ ...slot, createdAt: Date.now() });
}

export function clearSelectedSlot(): void {
	selectedSlot.set(null);
}
