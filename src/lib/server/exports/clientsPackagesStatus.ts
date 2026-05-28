import { query } from '$lib/db';
import { getNextStockholmDayStartLocal, getStockholmYmd } from '$lib/server/packageSemantics';

export const DEFAULT_SESSIONS_LIMIT = 5;

// Legacy export intentionally does not filter client_customer_relationships.active.
const TRAINING_RELATIONSHIP_SQL = `'Training', 'Training and Membership'`;
const WORKSHEET_NAME = 'Klienter med få träningar kvar';
const HEADERS = ['Klient', 'KlientId', 'Återstående träningar'] as const;

export type ClientsPackagesStatusRow = {
	clientName: string;
	clientId: number;
	remaining: number;
};

type DbRow = {
	client_name: string | null;
	client_id: number | string;
	remaining: number | string | null;
};

type BuildRowsOptions = {
	sessionsLimit?: unknown;
	asOf?: Date;
	limit?: number;
	offset?: number;
};

type WorkbookOptions = BuildRowsOptions;

type ExcelModule = typeof import('exceljs');

export function normalizeSessionsLimit(value: unknown) {
	const parsed =
		typeof value === 'number'
			? value
			: Number(
					String(value ?? '')
						.trim()
						.replace(',', '.')
				);

	if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SESSIONS_LIMIT;

	const integerLimit = Math.trunc(parsed);
	return integerLimit > 0 ? integerLimit : DEFAULT_SESSIONS_LIMIT;
}

async function createWorkbook(): Promise<import('exceljs').Workbook> {
	const mod = (await import('exceljs')) as ExcelModule & { default?: ExcelModule };
	const excelNs = mod.Workbook ? mod : mod.default;
	if (!excelNs?.Workbook) {
		throw new Error('ExcelJS module does not expose a Workbook constructor.');
	}
	return new excelNs.Workbook();
}

function createFilename(generatedAt: string, sessionsLimit: number) {
	const now = new Date(generatedAt);
	const datePart = now.toISOString().slice(0, 10);
	const timePart = now.toISOString().slice(11, 16).replace(':', '');
	return `clients_with_few_trainings_left_${sessionsLimit}_${datePart}_${timePart}.xlsx`;
}

function toRow(row: DbRow): ClientsPackagesStatusRow {
	return {
		clientName: row.client_name ?? '',
		clientId: Number(row.client_id),
		remaining: Math.trunc(Number(row.remaining ?? 0))
	};
}

export async function getClientsPackagesStatusRows({
	sessionsLimit,
	asOf = new Date(),
	limit: rowLimit,
	offset = 0
}: BuildRowsOptions = {}): Promise<ClientsPackagesStatusRow[]> {
	const limit = normalizeSessionsLimit(sessionsLimit);
	const todayYmd = getStockholmYmd(asOf);
	const nextDayStartLocal = todayYmd ? getNextStockholmDayStartLocal(todayYmd) : null;
	const params: unknown[] = [todayYmd, asOf, nextDayStartLocal, limit];
	let paginationSql = '';

	if (Number.isInteger(rowLimit) && Number(rowLimit) > 0) {
		params.push(Number(rowLimit));
		paginationSql += ` LIMIT $${params.length}`;

		if (Number.isInteger(offset) && Number(offset) > 0) {
			params.push(Number(offset));
			paginationSql += ` OFFSET $${params.length}`;
		}
	}

	if (!todayYmd || !nextDayStartLocal) {
		throw new Error('Failed to determine current Stockholm business date.');
	}

	const rows = await query<DbRow>(
		`
		WITH active_clients AS (
			SELECT
				c.id,
				c.firstname,
				c.lastname,
				ROW_NUMBER() OVER (
					ORDER BY c.lastname ASC NULLS LAST, c.firstname ASC NULLS LAST, c.id ASC
				) AS client_order
			FROM clients c
			WHERE c.active = TRUE
		),
		valid_package_base AS (
			SELECT
				p.id AS package_id,
				p.client_id AS package_client_id,
				p.customer_id,
				COALESCE(a.sessions, 0)::int AS total_sessions
			FROM packages p
			JOIN articles a ON a.id = p.article_id
			WHERE (p.frozen_from_date IS NULL OR p.frozen_from_date > $2::timestamp)
				AND (a.validity_start_date IS NULL OR a.validity_start_date <= $1::date)
				AND (a.validity_end_date IS NULL OR a.validity_end_date >= $1::date)
		),
		valid_packages AS (
			SELECT
				ac.id AS client_id,
				vpb.package_id,
				vpb.package_client_id,
				vpb.customer_id,
				vpb.total_sessions
			FROM active_clients ac
			JOIN valid_package_base vpb ON vpb.package_client_id = ac.id

			UNION ALL

			SELECT DISTINCT
				ac.id AS client_id,
				vpb.package_id,
				vpb.package_client_id,
				vpb.customer_id,
				vpb.total_sessions
			FROM active_clients ac
			JOIN client_customer_relationships ccr ON ccr.client_id = ac.id
				AND ccr.relationship IN (${TRAINING_RELATIONSHIP_SQL})
			JOIN valid_package_base vpb ON vpb.package_client_id IS NULL
				AND vpb.customer_id = ccr.customer_id
		),
		package_usage AS (
			SELECT
				b.package_id,
				COUNT(*)::int AS used_sessions
			FROM bookings b
			WHERE b.package_id IS NOT NULL
				AND (b.status IS NULL OR b.status <> 'Cancelled')
				AND b.start_time < $3::timestamp
			GROUP BY b.package_id
		),
		shared_people AS (
			SELECT
				p.id AS package_id,
				COUNT(DISTINCT c.id)::int AS number_of_people
			FROM packages p
			JOIN client_customer_relationships ccr ON ccr.customer_id = p.customer_id
				AND ccr.relationship IN (${TRAINING_RELATIONSHIP_SQL})
			JOIN clients c ON c.id = ccr.client_id
				AND c.active = TRUE
			WHERE p.client_id IS NULL
			GROUP BY p.id
		),
		client_totals AS (
			SELECT
				ac.id AS client_id,
				BTRIM(CONCAT(COALESCE(ac.firstname, ''), ' ', COALESCE(ac.lastname, ''))) AS client_name,
				ac.client_order,
				COUNT(vp.package_id)::int AS package_count,
				COALESCE(
					SUM(
						CASE
							WHEN vp.package_client_id = ac.id THEN
								(vp.total_sessions - COALESCE(pu.used_sessions, 0))::numeric
							WHEN vp.package_client_id IS NULL THEN
								COALESCE(
									FLOOR(
										(vp.total_sessions - COALESCE(pu.used_sessions, 0))::numeric
										/ NULLIF(sp.number_of_people, 0)
									),
									0
								)
							ELSE 0
						END
					),
					0
				)::int AS remaining
			FROM active_clients ac
			LEFT JOIN valid_packages vp ON vp.client_id = ac.id
			LEFT JOIN package_usage pu ON pu.package_id = vp.package_id
			LEFT JOIN shared_people sp ON sp.package_id = vp.package_id
			GROUP BY ac.id, ac.firstname, ac.lastname, ac.client_order
		)
		SELECT
			client_name,
			client_id,
			remaining
		FROM client_totals
		WHERE (package_count > 0 AND remaining <= $4::int)
			OR package_count = 0
		ORDER BY
			CASE WHEN package_count > 0 THEN 0 ELSE 1 END,
			CASE WHEN package_count > 0 THEN remaining END DESC,
			client_order ASC
		${paginationSql}
		`,
		params
	);

	return rows.map(toRow);
}

export async function buildClientsPackagesStatusWorkbook(options: WorkbookOptions = {}) {
	const sessionsLimit = normalizeSessionsLimit(options.sessionsLimit);
	const generatedAt = new Date().toISOString();
	const rows = await getClientsPackagesStatusRows({
		...options,
		sessionsLimit
	});

	const workbook = await createWorkbook();
	const worksheet = workbook.addWorksheet(WORKSHEET_NAME);

	worksheet.addRow([...HEADERS]);
	worksheet.getRow(1).font = { bold: true };

	for (const row of rows) {
		worksheet.addRow([row.clientName, row.clientId, row.remaining]);
	}

	worksheet.getColumn(2).numFmt = '0';
	worksheet.getColumn(3).numFmt = '0';

	worksheet.columns?.forEach((column) => {
		if (!column) return;
		let max = 12;
		column.eachCell?.({ includeEmpty: true }, (cell) => {
			const text = cell.value?.toString?.() ?? '';
			if (text.length + 2 > max) max = text.length + 2;
		});
		column.width = Math.min(max, 48);
	});

	worksheet.views = [{ state: 'frozen', ySplit: 1 }];

	const rawBuffer = await workbook.xlsx.writeBuffer();
	const buffer =
		rawBuffer instanceof Uint8Array ? rawBuffer : new Uint8Array(rawBuffer as ArrayBuffer);

	return {
		buffer,
		filename: createFilename(generatedAt, sessionsLimit),
		rows,
		sessionsLimit
	};
}
