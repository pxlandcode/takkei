import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
	user: process.env.PGUSER,
	host: process.env.PGHOST,
	database: process.env.PGDATABASE,
	password: process.env.PGPASSWORD,
	port: process.env.PGPORT
});

export const query = async (text, params) => {
	const client = await pool.connect();
	try {
		const res = await client.query(text, params);
		return res.rows;
	} finally {
		client.release();
	}
};
