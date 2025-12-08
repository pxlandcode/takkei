import { get } from 'svelte/store';
import { fetchActiveGreetings } from '$lib/services/api/greetingService';
import type { Greeting as GreetingType } from '$lib/types/greeting';
import { user } from '$lib/stores/userStore';

export type Greeting = GreetingType & {
	condition?: (user: any) => boolean;
};

const fallbackGreetings: Greeting[] = [
	{ message: 'Hej, {name}!', icon: '👋' },
	{ message: 'TAKKEI ❤️ DIG!', icon: '' },
	{ message: 'Nu kör vi!', icon: '🚗' },
	{ message: 'Du är bäst!', icon: '💪' },
	{ message: 'Du är en', icon: '🌟' },
	{ message: 'Du rockar!', icon: '🤘' },
	{ message: 'Dags att svettas!', icon: '🔥' },
	{ message: 'Kämpa på!', icon: '🏋️' },
	{ message: 'Push it to the limit!', icon: '🚀' },
	{ message: 'En rep till!', icon: '🔁' },
	{ message: 'Gains på väg!', icon: '🥩' },
	{ message: 'Starkare än igår!', icon: '📈' },
	{ message: 'Du är nr. 1!', icon: '🥇' }
];

export const specialGreetings: Greeting[] = [
	{
		message: 'Grattis på födelsedagen!',
		icon: '🎂',
		condition: (user) => {
			const today = new Date().toISOString().slice(5, 10);
			return user?.birthday?.slice(5, 10) === today;
		}
	}
];

let cachedGreetings: Greeting[] | null = null;
let fetchPromise: Promise<Greeting[]> | null = null;

async function loadActiveGreetings(fetchFn?: typeof fetch): Promise<Greeting[]> {
	if (cachedGreetings) return cachedGreetings;
	if (!fetchPromise) {
		fetchPromise = fetchActiveGreetings(fetchFn)
			.then((rows) => {
				const normalized = (rows ?? [])
					.filter((g) => (g.active ?? true) && g.message)
					.map((g) => ({
						...g,
						icon: g.icon ?? ''
					}));
				if (normalized.length === 0) {
					return [{ message: 'Hej, {name}', icon: '👋' }];
				}
				return normalized;
			})
			.catch((error) => {
				console.error('Failed to fetch greetings, using fallback', error);
				return fallbackGreetings;
			})
			.then((result) => {
				cachedGreetings = result;
				return result;
			})
			.finally(() => {
				fetchPromise = null;
			});
	}
	return fetchPromise;
}

function personalize(message: string, name?: string): string {
	if (!message) return message;
	if (!name) return message.replace('{name}', 'du');
	return message.replace('{name}', name);
}

export async function getGreeting(fetchFn?: typeof fetch): Promise<Greeting> {
	const currentUser = get(user);
	const username = currentUser?.firstname;

	for (const greeting of specialGreetings) {
		if (greeting.condition && greeting.condition(currentUser)) {
			return {
				...greeting,
				message: personalize(greeting.message, username)
			};
		}
	}

	const greetings = await loadActiveGreetings(fetchFn);
	const pool = greetings.length ? greetings : fallbackGreetings;
	const randomGreeting = pool[Math.floor(Math.random() * pool.length)];
	return {
		...randomGreeting,
		message: personalize(randomGreeting.message, username)
	};
}

export function clearGreetingCache() {
	cachedGreetings = null;
	fetchPromise = null;
}
