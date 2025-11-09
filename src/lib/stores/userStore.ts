import type { AuthenticatedUser } from '$lib/types/userTypes';
import { writable } from 'svelte/store';

export const user = writable<AuthenticatedUser | null>(null);
