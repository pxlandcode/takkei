import { get } from 'svelte/store';
import { user } from '$lib/stores/userStore';

export type Greeting = {
	message: string;
	icon?: string;
	condition?: (user: any) => boolean;
};

// Define greetings list
export const greetings: Greeting[] = [
	{ message: 'Hej, {name}!', icon: '👋' },
	{ message: 'TAKKEI ❤️ DIG!', icon: '' },
	{ message: 'Nu kör vi!', icon: '🚗' },
	{ message: 'Du är bäst!', icon: '💪' },
	{ message: 'Du är en:', icon: '🌟' },
	{ message: 'Du rockar!', icon: '🤘' },
	{ message: 'Dags att svettas!', icon: '🔥' },
	{ message: 'Kämpa på!', icon: '🏋️' },
	{ message: 'Push it to the limit!', icon: '🚀' },
	{ message: 'En rep till!', icon: '🔁' },
	{ message: 'Gains på väg!', icon: '🥩' },
	{ message: 'Starkare än igår!', icon: '📈' },
	{ message: 'Du är nr. 1!', icon: '🥇' }
];

// Define special greetings with conditions
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

export function getGreeting(): Greeting {
	const currentUser = get(user); // Get the latest user value at runtime
	const username = currentUser?.firstname;

	// Check for special greetings
	for (const greeting of specialGreetings) {
		if (greeting.condition && greeting.condition(currentUser)) {
			return greeting;
		}
	}

	// Get a random greeting and replace `{name}` with the user's name
	const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
	return {
		...randomGreeting,
		message: randomGreeting.message.replace('{name}', username)
	};
}
