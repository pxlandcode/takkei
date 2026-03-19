export const CANCELLED_STATUS = 'Cancelled' as const;
export const LATE_CANCELLED_STATUS = 'Late_cancelled' as const;

export const cancellationReasonOptions = [
	{ value: 'Rebook', label: 'Flyttat träningen' },
	{ value: 'Family', label: 'Familj' },
	{ value: 'Work', label: 'Arbete' },
	{ value: 'Travel', label: 'Resa' },
	{ value: 'Illness', label: 'Sjukdom' },
	{ value: 'Injury', label: 'Skada' },
	{ value: 'Injury Takkei', label: 'Skada på Takkei' },
	{ value: 'Injury external', label: 'Skada utanför Takkei' },
	{ value: 'No_show', label: 'Dök inte upp' },
	{ value: 'Other', label: 'Övrigt' },
	{ value: 'Unknown', label: 'Vet ej' }
] as const;

export type CancellationEmailBehavior = 'send' | 'edit' | 'none';

function sameCalendarDay(a: Date, b: Date) {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

function asDate(value: string | Date) {
	return value instanceof Date ? value : new Date(value);
}

export function isWithinCancellationWindow(startValue: string | Date, cancelValue: string | Date) {
	const start = asDate(startValue);
	const cancelAt = asDate(cancelValue);

	if (Number.isNaN(start.getTime()) || Number.isNaN(cancelAt.getTime())) {
		return false;
	}

	const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
	const cancelPlus24 = new Date(cancelAt.getTime() + 24 * 60 * 60 * 1000);
	const dayAfterCancel = new Date(
		cancelAt.getFullYear(),
		cancelAt.getMonth(),
		cancelAt.getDate() + 1
	);
	const tomorrowBeforeNoon = sameCalendarDay(start, dayAfterCancel) && cancelAt.getHours() < 12;

	return startMidnight > cancelPlus24 || tomorrowBeforeNoon;
}

export function isLateCancellation(startValue: string | Date, cancelValue: string | Date) {
	return !isWithinCancellationWindow(startValue, cancelValue);
}

export function toLocalDateTimeInputValue(value: string | Date | null | undefined) {
	if (!value) return '';

	const date = asDate(value);
	if (Number.isNaN(date.getTime())) return '';

	const pad = (part: number) => part.toString().padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getCancellationStatusLabel(status?: string | null) {
	if (!status) return 'Avbokad';
	if (status === LATE_CANCELLED_STATUS) return 'Sen avbokning';
	return 'Avbokad';
}

export function getEditableCancellationTime(
	actualCancelTime?: string | null,
	cancelTime?: string | null
) {
	return toLocalDateTimeInputValue(actualCancelTime ?? cancelTime ?? null);
}
