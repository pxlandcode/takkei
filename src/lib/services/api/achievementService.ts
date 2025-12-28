import { wrapFetch } from '$lib/services/api/apiCache';

export async function fetchUserAchievements(userId: number, date: string) {
	const response = await wrapFetch(fetch)(`/api/achievements?userId=${userId}&date=${date}`);
	if (!response.ok) {
		throw new Error('Failed to fetch achievements');
	}
	return response.json();
}
