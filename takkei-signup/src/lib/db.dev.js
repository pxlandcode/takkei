import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const databasePort = Number.parseInt(process.env.PGPORT || '', 10);

/** @type {import('pg').PoolConfig} */
const poolConfig = {
	user: process.env.PGUSER,
	host: process.env.PGHOST,
	database: process.env.PGDATABASE,
	password: process.env.PGPASSWORD
};

if (Number.isInteger(databasePort) && databasePort > 0) {
	poolConfig.port = databasePort;
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
