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

const APP_TZ = 'Europe/Stockholm';

// Detects strings like 'YYYY-MM-DD HH:mm' or 'YYYY-MM-DD HH:mm:ss' or 'YYYY-MM-DD'
const DATE_LIKE_RE = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/;

// Convert a Stockholm local wall time to a UTC Date
function stockholmLocalStringToUtcDate(localStr) {
	// Accept 'YYYY-MM-DD' -> midnight
	let s = localStr.trim().replace('T', ' ');
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += ' 00:00:00';
	else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) s += ':00';

	// Parse wall-time components
	const [datePart, timePart] = s.split(' ');
	const [Y, M, D] = datePart.split('-').map(Number);
	const [h, m, sec] = timePart.split(':').map(Number);

	// Create a UTC date with same components
	const asIfUtc = new Date(Date.UTC(Y, M - 1, D, h, m, sec || 0));

	// Ask: what wall time would that UTC instant be in Stockholm?
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: APP_TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	})
		.formatToParts(asIfUtc)
		.reduce((acc, p) => ((acc[p.type] = p.value), acc), {});

	const tzY = +parts.year,
		tzM = +parts.month,
		tzD = +parts.day;
	const tzH = +parts.hour,
		tzMin = +parts.minute,
		tzS = +parts.second;

	// Compute the DST offset by comparing components
	const intendedUTC = Date.UTC(Y, M - 1, D, h, m, sec || 0);
	const stockholmEvaluatedUTC = Date.UTC(tzY, tzM - 1, tzD, tzH, tzMin, tzS);
	const offsetMs = stockholmEvaluatedUTC - intendedUTC;

	// Real UTC instant for the intended Stockholm wall time
	return new Date(asIfUtc.getTime() - offsetMs);
}

function normalizeParam(p) {
	if (!p) return p;

	// If it's already a Date, convert to UTC ISO (preserve instant)
	if (p instanceof Date) return p.toISOString();

	if (typeof p === 'string') {
		const str = p.trim();

		// Already UTC ISO? leave it
		if (/^\d{4}-\d{2}-\d{2}T.*Z$/.test(str)) return str;

		// If it "looks like" a date/time but has no timezone, treat as Stockholm local
		if (DATE_LIKE_RE.test(str)) {
			return stockholmLocalStringToUtcDate(str).toISOString();
		}
	}

	return p;
}

export const query = async (text, params = []) => {
	const client = await pool.connect();
	try {
		const norm = Array.isArray(params) ? params.map(normalizeParam) : params;
		const res = await client.query(text, norm);
		return res.rows;
	} finally {
		client.release();
	}
};
