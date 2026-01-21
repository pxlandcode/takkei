import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool, types } = pkg;

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

const defaultPoolSize = isProduction || useProdDb ? 5 : 10;

export const pool = new Pool({
        connectionString,
        ssl: isProduction || useProdDb ? { rejectUnauthorized: false } : false,
        max: Number(process.env.DATABASE_POOL_MAX ?? defaultPoolSize)
});

// Detects strings like 'YYYY-MM-DD HH:mm' or 'YYYY-MM-DD HH:mm:ss' or 'YYYY-MM-DD'
const DATE_LIKE_RE = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?)?$/;

function getLastSundayOfMonth(year, monthIndex) {
	const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
	const day = lastDay.getUTCDay();
	lastDay.setUTCDate(lastDay.getUTCDate() - day);
	return lastDay.getUTCDate();
}

function isStockholmDst(year, month, day, hour) {
	if (month < 3 || month > 10) return false;
	if (month > 3 && month < 10) return true;

	const marchLastSunday = getLastSundayOfMonth(year, 2);
	const octoberLastSunday = getLastSundayOfMonth(year, 9);

	if (month === 3) {
		if (day > marchLastSunday) return true;
		if (day < marchLastSunday) return false;
		return hour >= 2;
	}

	if (day < octoberLastSunday) return true;
	if (day > octoberLastSunday) return false;
	return hour < 3;
}

function getStockholmOffsetMinutes(year, month, day, hour) {
	return isStockholmDst(year, month, day, hour) ? 120 : 60;
}

// Convert a Stockholm local wall time to a UTC Date
function stockholmLocalStringToUtcDate(localStr) {
	// Accept 'YYYY-MM-DD' -> midnight
	let s = localStr.trim().replace('T', ' ');
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += ' 00:00:00';
	else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) s += ':00';

	// Parse wall-time components
	const [datePart, timePart] = s.split(' ');
	const [Y, M, D] = datePart.split('-').map(Number);
	const [hStr, mStr, secStrWithMs = '0'] = timePart.split(':');
	const h = Number(hStr);
	const m = Number(mStr);
	const [secStr, msStr = '0'] = secStrWithMs.split('.');
	const sec = Number(secStr || 0);
	const ms = Number((msStr + '000').slice(0, 3));
	const offsetMinutes = getStockholmOffsetMinutes(Y, M, D, h);
	const intendedUTC = Date.UTC(Y, M - 1, D, h, m, sec || 0, ms);
	return new Date(intendedUTC - offsetMinutes * 60 * 1000);
}

function timestampStringToUtcDate(timestampStr) {
	if (!timestampStr) return timestampStr;
	const normalized = timestampStr.trim().replace('T', ' ');
	const [datePart, timePart = '00:00:00'] = normalized.split(' ');
	const [Y, M, D] = datePart.split('-').map(Number);
	if ([Y, M, D].some((n) => Number.isNaN(n))) throw new Error('Invalid date part');
	const [hStr = '00', mStr = '00', secStrWithMs = '00'] = timePart.split(':');
	const [secStr, msStr = '0'] = secStrWithMs.split('.');
	const h = Number(hStr);
	const m = Number(mStr);
	const sec = Number(secStr || 0);
	const ms = Number((msStr + '000').slice(0, 3));
	if ([h, m, sec, ms].some((n) => Number.isNaN(n))) throw new Error('Invalid time part');
	return new Date(Date.UTC(Y, M - 1, D, h, m, sec, ms));
}

function timestampWithoutTimezoneToUtcIso(value) {
	if (!value) return value;
	try {
		return timestampStringToUtcDate(value).toISOString();
	} catch (err) {
		return value;
	}
}

// Ensure "timestamp without time zone" values are interpreted as UTC instants
const TIMESTAMP_OID = 1114;

types.setTypeParser(TIMESTAMP_OID, timestampWithoutTimezoneToUtcIso);

function formatDateAsPgTimestamp(date) {
	const pad = (n) => n.toString().padStart(2, '0');
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function normalizeParam(p) {
	if (p === null || p === undefined) return p;

	if (p instanceof Date) return formatDateAsPgTimestamp(p);

	if (typeof p === 'string') {
		const str = p.trim();
		const isoish = str.replace(' ', 'T');
		if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(isoish)) {
			const parsed = new Date(isoish);
			if (!Number.isNaN(parsed.getTime())) {
				return formatDateAsPgTimestamp(parsed);
			}
		}

		if (DATE_LIKE_RE.test(str)) {
			if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str; // date columns stay date-only
			return formatDateAsPgTimestamp(stockholmLocalStringToUtcDate(str));
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
