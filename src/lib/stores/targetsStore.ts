import { fetchTargets } from '$lib/services/api/targetService';
import { writable } from 'svelte/store';

export const targetStore = writable<
	{
		id: number;
		title: string;
		target: number;
		achieved: number;
		target_kind_name: string;
		rules: any;
	}[]
>([]);

export async function updateTargets(userId: number, date: string) {
	try {
		const targets = await fetchTargets(userId, date);
		targetStore.set(targets); // Update the store with fresh data
	} catch (error) {
		console.error('Error updating targets:', error);
	}
}
