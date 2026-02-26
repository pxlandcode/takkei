import { extractStockholmTimeParts } from '$lib/server/stockholm-time';

export const CANCELLED_STATUS = 'Cancelled' as const;
export const LATE_CANCELLED_STATUS = 'Late_cancelled' as const;
export const TRAINING_RELATIONSHIPS = ['Training', 'Training and Membership'] as const;

type DateLike = Date | string | null | undefined;

export type PackageFlags = {
	internal?: boolean | null;
	education?: boolean | null;
	try_out?: boolean | null;
	internal_education?: boolean | null;
};

export type PackageUsabilityInput = {
	frozen_from_date?: string | null;
	validity_start_date?: string | null;
	validity_end_date?: string | null;
};

export type ActivePackageCandidate = {
	id: number;
	is_personal?: boolean | null;
	is_shared?: boolean | null;
	remaining_sessions?: number | null;
	first_payment_date?: string | null;
	frozen_from_date?: string | null;
	validity_start_date?: string | null;
	validity_end_date?: string | null;
	article?: {
		validity_start_date?: string | null;
		validity_end_date?: string | null;
	} | null;
};

function pad2(value: number) {
	return String(value).padStart(2, '0');
}

function ymdFromParts(parts: { year: number; month: number; day: number }) {
	return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function parseYmd(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const [year, month, day] = value.split('-').map(Number);
	if ([year, month, day].some((n) => !Number.isFinite(n))) return null;
	return { year, month, day };
}

function addDaysToYmd(value: string, days: number) {
	const parsed = parseYmd(value);
	if (!parsed) return null;
	const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
	date.setUTCDate(date.getUTCDate() + days);
	return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function toYmd(value: DateLike) {
	if (!value) return null;
	if (typeof value === 'string') {
		const match = value.match(/\d{4}-\d{2}-\d{2}/);
		return match ? match[0] : null;
	}
	const parts = extractStockholmTimeParts(value);
	return parts ? ymdFromParts(parts) : null;
}

function resolveValidityStart(pkg: ActivePackageCandidate) {
	return pkg.validity_start_date ?? pkg.article?.validity_start_date ?? null;
}

function resolveValidityEnd(pkg: ActivePackageCandidate) {
	return pkg.validity_end_date ?? pkg.article?.validity_end_date ?? null;
}

export function isChargeablePackageBookingStatus(status: string | null | undefined) {
	return status !== CANCELLED_STATUS;
}

export function bookingConsumesPackage(flags: PackageFlags) {
	return !Boolean(flags.internal) && !Boolean(flags.education) && !Boolean(flags.try_out);
}

export function getStockholmYmd(value: DateLike = new Date()) {
	if (typeof value === 'string') {
		const match = value.match(/\d{4}-\d{2}-\d{2}/);
		if (match) return match[0];
	}
	const parts = extractStockholmTimeParts(value);
	return parts ? ymdFromParts(parts) : null;
}

export function getNextStockholmDayStartLocal(value: DateLike = new Date()) {
	const ymd = getStockholmYmd(value);
	if (!ymd) return null;
	const next = addDaysToYmd(ymd, 1);
	return next ? `${next} 00:00:00` : null;
}

export function isPackageUsableOnDate(pkg: PackageUsabilityInput, checkYmd: string) {
	const frozenFrom = toYmd(pkg.frozen_from_date);
	if (frozenFrom && frozenFrom <= checkYmd) return false;

	const validityStart = toYmd(pkg.validity_start_date);
	if (validityStart && validityStart > checkYmd) return false;

	const validityEnd = toYmd(pkg.validity_end_date);
	if (validityEnd && validityEnd < checkYmd) return false;

	return true;
}

export function chargeablePackageBookingSql(alias = 'b') {
	return `(${alias}.status IS NULL OR ${alias}.status <> '${CANCELLED_STATUS}')`;
}

export function trainingRelationshipSql(alias = 'ccr') {
	return `COALESCE(${alias}.active, TRUE) = TRUE AND ${alias}.relationship IN (${TRAINING_RELATIONSHIPS.map((v) => `'${v}'`).join(', ')})`;
}

export function packageFreeExclusionSql(alias = 'b') {
	return `COALESCE(${alias}.internal, false) = false AND COALESCE(${alias}.education, false) = false AND COALESCE(${alias}.try_out, false) = false`;
}

function compareNullableYmdAscNullsLast(left: string | null, right: string | null) {
	if (left && right) return left.localeCompare(right);
	if (!left && right) return 1;
	if (left && !right) return -1;
	return 0;
}

function compareValidityEndDescDefinedFirst(
	left: ActivePackageCandidate,
	right: ActivePackageCandidate
) {
	const leftEnd = toYmd(resolveValidityEnd(left));
	const rightEnd = toYmd(resolveValidityEnd(right));

	if (leftEnd && rightEnd) return rightEnd.localeCompare(leftEnd);
	if (leftEnd && !rightEnd) return -1;
	if (!leftEnd && rightEnd) return 1;
	return 0;
}

function compareActiveCandidates(left: ActivePackageCandidate, right: ActivePackageCandidate) {
	const validityCmp = compareValidityEndDescDefinedFirst(left, right);
	if (validityCmp !== 0) return validityCmp;

	const paymentCmp = compareNullableYmdAscNullsLast(toYmd(left.first_payment_date), toYmd(right.first_payment_date));
	if (paymentCmp !== 0) return paymentCmp;

	return Number(left.id) - Number(right.id);
}

function isCandidateEligible(candidate: ActivePackageCandidate, checkYmd: string) {
	const remaining = Number(candidate.remaining_sessions ?? NaN);
	if (!Number.isFinite(remaining) || remaining <= 0) return false;

	return isPackageUsableOnDate(
		{
			frozen_from_date: candidate.frozen_from_date ?? null,
			validity_start_date: toYmd(resolveValidityStart(candidate)),
			validity_end_date: toYmd(resolveValidityEnd(candidate))
		},
		checkYmd
	);
}

export function selectActivePackage<T extends ActivePackageCandidate>(packages: T[], checkYmd: string): T | null {
	if (!Array.isArray(packages) || packages.length === 0) return null;

	const eligible = packages.filter((pkg) => isCandidateEligible(pkg, checkYmd));
	if (!eligible.length) return null;

	const personal = eligible.filter((pkg) => Boolean(pkg.is_personal));
	const shared = eligible.filter((pkg) => !pkg.is_personal && (pkg.is_shared === true || pkg.is_shared == null));
	const pool = personal.length ? personal : shared;
	if (!pool.length) return null;

	return [...pool].sort(compareActiveCandidates)[0] ?? null;
}
