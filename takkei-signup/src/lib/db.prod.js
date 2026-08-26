import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const databaseSsl = process.env.DATABASE_SSL !== 'false';
const databasePoolMax = Number.parseInt(process.env.DATABASE_POOL_MAX || '', 10);

if (!connectionString) {
	throw new Error('Missing SUPABASE_DATABASE_URL or DATABASE_URL environment variable');
}

/** @type {import('pg').PoolConfig} */
const poolConfig = {
	connectionString,
	ssl: databaseSsl ? { rejectUnauthorized: false } : false
};

if (Number.isInteger(databasePoolMax) && databasePoolMax > 0) {
	poolConfig.max = databasePoolMax;
}

const pool = new Pool(poolConfig);

/**
 * @param {string} text
 * @param {unknown[]} [params]
 * @returns {Promise<Record<string, any>[]>}
 */
export const query = async (text, params) => {
	const client = await pool.connect();
	try {
		const res = await client.query(text, params);
		return /** @type {Record<string, any>[]} */ (res.rows);
	} catch (err) {
		console.error('Database Query Error:', err);
		throw err;
	} finally {
		client.release();
	}
};
