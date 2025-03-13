import { writable } from 'svelte/store';
import { fetchUserAchievements } from '$lib/services/api/achievementService';

export const achievementStore = writable<
	{
		id: number;
		name: string;
		achieved: number;
		rules: any;
	}[]
>([]);

export async function updateAchievements(userId: number, date: string) {
	try {
		const achievements = await fetchUserAchievements(userId, date);
		achievementStore.set(achievements);
	} catch (error) {
		console.error('Error updating achievements:', error);
	}
}
