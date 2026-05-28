import { DEFAULT_SESSIONS_LIMIT } from '$lib/server/exports/clientsPackagesStatus';

export const load = () => {
	return {
		defaultSessionsLimit: DEFAULT_SESSIONS_LIMIT
	};
};
