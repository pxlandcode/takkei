// import type { PageServerLoad } from './$types';
// import { profileStore } from '$lib/stores/profileStore';

// export const load: PageServerLoad = async ({ fetch, params }) => {
// 	const trainerId = Number(params.slug);
// 	console.log(`[+page.server.ts] Loading user ID: ${trainerId}`);

// 	await profileStore.loadUser(trainerId, fetch);

// 	console.log(`[+page.server.ts] User should now be in profileStore.`);
// 	return { trainerId };
// };
