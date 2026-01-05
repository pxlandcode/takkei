import { writable } from 'svelte/store';
import { fetchUserAchievements } from '$lib/services/api/achievementService';

type Achievement = {
	id: number;
	title: string;
	description?: string;
	achieved: number;
	rules: any;
	start_date?: string | null;
	end_date?: string | null;
	// Legacy field kept for backwards compatibility
	name?: string;
};

export const achievementStore = writable<Achievement[]>([]);

export async function updateAchievements(userId: number, date: string) {
	try {
		const achievements: Achievement[] = await fetchUserAchievements(userId, date);
		achievementStore.set(achievements);
	} catch (error) {
		console.error('Error updating achievements:', error);
	}
}
