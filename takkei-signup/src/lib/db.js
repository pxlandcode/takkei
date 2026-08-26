import dotenv from 'dotenv';

dotenv.config();

let dbModule;
const useRemoteDb = process.env.USE_REMOTE_DB?.toLowerCase() === 'true';

if (process.env.NODE_ENV === 'development' && !useRemoteDb) {
	dbModule = await import('./db.dev.js');
} else {
	dbModule = await import('./db.prod.js');
}

export const { query } = dbModule;
