export async function fetchTargets(userId: number, date: string) {
	const response = await fetch(`/api/targets?userId=${userId}&date=${date}`);
	if (!response.ok) {
		throw new Error('Failed to fetch targets');
	}
	return response.json();
}
