const baseUrl = '/api/availability';

// ✅ Fix: match server-side param name
export async function fetchAvailability(userId: number) {
	const res = await fetch(`${baseUrl}?userId=${userId}`);
	if (!res.ok) throw new Error('Kunde inte hämta tillgänglighet.');
	return await res.json();
}

// ✅ Weekly Availability
export async function saveWeeklyAvailability(userId: number, weeklyAvailability: any[]) {
	const payload = {
		userId,
		weeklyAvailability: weeklyAvailability.map((item) => ({
			...item,
			userId // Redundant if already injected, but safe
		}))
	};

	const res = await fetch(`${baseUrl}/weekly`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (!res.ok) throw new Error('Misslyckades att spara veckoschema.');
	return await res.json();
}

// ✅ Date Availability
export async function saveDateAvailability(
	userId: number,
	dateAvailabilities: { date: string; from: string; to: string }[]
) {
	for (const item of dateAvailabilities) {
		const res = await fetch(`${baseUrl}/date`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId, ...item })
		});
		if (!res.ok) throw new Error(`Misslyckades att spara datum ${item.date}`);
	}
}

export async function removeDateAvailability(id: number) {
	const res = await fetch(`/api/availability/date?id=${id}`, {
		method: 'DELETE'
	});

	if (!res.ok) {
		throw new Error('Misslyckades att ta bort datumtillgänglighet.');
	}

	return await res.json();
}

// ✅ Vacations
export async function saveVacations(userId: number, vacations: { from: string; to: string }[]) {
	for (const vacation of vacations) {
		const res = await fetch(`${baseUrl}/vacation`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId, ...vacation })
		});
		if (!res.ok) throw new Error(`Misslyckades att spara semester ${vacation.from}–${vacation.to}`);
	}
}

export async function removeVacation(id: number) {
	const res = await fetch(`/api/availability/vacation?id=${id}`, {
		method: 'DELETE'
	});

	if (!res.ok) {
		throw new Error('Misslyckades att ta bort semester');
	}

	return await res.json();
}

export async function saveOrUpdateAbsences(
	userId: number,
	absences: {
		id?: number;
		description?: string;
		approverId?: number;
		end_time?: string;
		status?: string;
	}[]
): Promise<any[]> {
	const saved: any[] = [];

	for (const absence of absences) {
		if (absence.id) {
			const res = await fetch('/api/availability/absence', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					absenceId: absence.id,
					approverId: absence.approverId,
					endTime: absence.end_time,
					status: absence.status
				})
			});

			if (!res.ok) {
				throw new Error(`Misslyckades att uppdatera frånvaro (id: ${absence.id})`);
			}

			const { absence: updatedAbsence } = await res.json();
			saved.push(updatedAbsence);
		} else {
			const payload = {
				userId,
				description: absence.description ?? ''
			};

			const res = await fetch('/api/availability/absence', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!res.ok)
				throw new Error(
					`Misslyckades att spara frånvaro (${absence.description || 'utan beskrivning'})`
				);

			const { absence: newAbsence } = await res.json();
			saved.push(newAbsence);
		}
	}

	return saved;
}
