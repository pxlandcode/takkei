export function hasRoomBlockAccess(user: any): boolean {
	if (!user) return false;

	const roleNames = new Set<string>();

	if (Array.isArray(user.roles)) {
		for (const role of user.roles) {
			if (!role) continue;
			const name = typeof role === 'string' ? role : role.name;
			if (typeof name === 'string' && name.trim()) {
				roleNames.add(name.trim().toLowerCase());
			}
		}
	}

	if (typeof user.role === 'string' && user.role.trim()) {
		roleNames.add(user.role.trim().toLowerCase());
	}

	return roleNames.has('administrator') || roleNames.has('locationadmin');
}

export function resolveActorTrainerId(authUser: App.Locals['user'] | null): number | null {
	if (!authUser || authUser.kind !== 'trainer') return null;
	const trainerId =
		typeof authUser.trainerId === 'number'
			? authUser.trainerId
			: typeof (authUser as { trainer_id?: unknown }).trainer_id === 'number'
				? ((authUser as { trainer_id?: number }).trainer_id ?? null)
				: null;

	return typeof trainerId === 'number' && Number.isInteger(trainerId) && trainerId > 0
		? trainerId
		: null;
}
