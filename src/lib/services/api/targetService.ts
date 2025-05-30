export async function fetchTargets(userId: number, date: string) {
	const response = await fetch(`/api/targets?userId=${userId}&date=${date}`);
	if (!response.ok) {
		throw new Error('Failed to fetch targets');
	}
	return response.json();
}

export async function createTarget(payload: any) {
	const res = await fetch('/api/targets', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (!res.ok) {
		throw new Error('Could not create target');
	}
}
