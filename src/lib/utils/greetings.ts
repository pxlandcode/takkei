import { get } from 'svelte/store';
import { fetchActiveGreetings } from '$lib/services/api/greetingService';
import type { Greeting as GreetingType, GreetingAudience } from '$lib/types/greeting';
import { user } from '$lib/stores/userStore';

export type Greeting = GreetingType & {
	condition?: (user: any) => boolean;
};

const fallbackGreetings: Greeting[] = [{ message: 'Hej, {name}!', icon: '👋', audience: 'both' }];

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

const cache: Record<GreetingAudience, Greeting[] | null> = {
	user: null,
	client: null,
	both: null
};

const fetchPromises: Partial<Record<GreetingAudience, Promise<Greeting[]>>> = {};

function normalizeAudience(value?: GreetingAudience | null): GreetingAudience {
	if (value === 'client' || value === 'user' || value === 'both') return value;
	return 'both';
}

function normalizeList(rows: GreetingType[], audience: GreetingAudience): Greeting[] {
	const normalizedAudience = normalizeAudience(audience);
	return (rows ?? [])
		.filter((g) => (g.active ?? true) && g.message)
		.filter((g) => {
			const a = normalizeAudience(g.audience as GreetingAudience);
			if (normalizedAudience === 'both') return true;
			return a === 'both' || a === normalizedAudience;
		})
		.map((g) => ({
			...g,
			icon: g.icon ?? '',
			audience: normalizeAudience(g.audience as GreetingAudience)
		}));
}

async function loadActiveGreetings(
	audience: GreetingAudience,
	fetchFn?: typeof fetch
): Promise<Greeting[]> {
	const audienceKey = normalizeAudience(audience);
	if (cache[audienceKey]) return cache[audienceKey] as Greeting[];

	if (!fetchPromises[audienceKey]) {
		fetchPromises[audienceKey] = fetchActiveGreetings({ fetchFn, audience: audienceKey })
			.then((rows) => {
				const normalized = normalizeList(rows, audienceKey);
				if (normalized.length === 0) {
					return [{ message: 'Hej, {name}', icon: '👋', audience: 'both' }];
				}
				return normalized;
			})
			.catch((error) => {
				console.error('Failed to fetch greetings, using fallback', error);
				return normalizeList(fallbackGreetings, audienceKey);
			})
			.then((result) => {
				cache[audienceKey] = result;
				return result;
			})
			.finally(() => {
				fetchPromises[audienceKey] = undefined;
			});
	}

	return fetchPromises[audienceKey] as Promise<Greeting[]>;
}

function personalize(message: string, name?: string): string {
	if (!message) return message;
	if (!name) return message.replace('{name}', 'du');
	return message.replace('{name}', name);
}

type GetGreetingOptions = {
	audience?: GreetingAudience;
	fetchFn?: typeof fetch;
};

export async function getGreeting(options: GetGreetingOptions = {}): Promise<Greeting> {
	const audience = normalizeAudience(options.audience ?? 'user');
	const currentUser = get(user);
	const username = currentUser?.firstname;

	for (const greeting of specialGreetings) {
		if (greeting.condition && greeting.condition(currentUser)) {
			return {
				...greeting,
				audience,
				message: personalize(greeting.message, username)
			};
		}
	}

	const greetings = await loadActiveGreetings(audience, options.fetchFn);
	const pool = greetings.length ? greetings : normalizeList(fallbackGreetings, audience);
	const randomGreeting = pool[Math.floor(Math.random() * pool.length)];
	return {
		...randomGreeting,
		message: personalize(randomGreeting.message, username)
	};
}

export function clearGreetingCache() {
	cache.user = null;
	cache.client = null;
	cache.both = null;
	fetchPromises.user = undefined;
	fetchPromises.client = undefined;
	fetchPromises.both = undefined;
}
