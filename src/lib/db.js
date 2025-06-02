import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const isProduction = process.env.NODE_ENV === 'production';
const useProdDb = process.env.USE_PROD_DB === 'true';

let connectionString;

// ✅ Priority order:
if (useProdDb) {
	// Local or production forced to use production DB
	connectionString = process.env.DATABASE_URL_PROD;
	console.log('⚠️  Using PRODUCTION database (from local or prod)');
} else if (isProduction) {
	// Heroku production: use Heroku-injected DATABASE_URL
	connectionString = process.env.DATABASE_URL;
	console.log('✅ Using Heroku DATABASE_URL (production)');
} else {
	// Local dev DB
	connectionString =
		process.env.DATABASE_URL ||
		`postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;
	console.log('✅ Using LOCAL database');
}

const pool = new Pool({
	connectionString,
	ssl: isProduction || useProdDb ? { rejectUnauthorized: false } : false
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
