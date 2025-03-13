export async function fetchUserAchievements(userId: number, date: string) {
	const response = await fetch(`/api/achievements?userId=${userId}&date=${date}`);
	if (!response.ok) {
		throw new Error('Failed to fetch achievements');
	}
	return response.json();
}
