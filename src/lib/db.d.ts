import type { Pool } from 'pg';

declare module '$lib/db' {
	export const pool: Pool;
	export function query<T = any>(text: string, params?: unknown[]): Promise<T[]>;
}

declare module '$lib/db.js' {
	export const pool: Pool;
	export function query<T = any>(text: string, params?: unknown[]): Promise<T[]>;
}
