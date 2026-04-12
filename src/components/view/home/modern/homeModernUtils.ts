import type { HomeModernClient, HomeModernNotificationEvent } from './homeModernTypes';
import { sortNotifications } from '$lib/utils/notifications';

const STOCKHOLM_TIME_ZONE = 'Europe/Stockholm';

export function addDays(date: Date, days: number) {
	const nextDate = new Date(date);
	nextDate.setDate(nextDate.getDate() + days);
	return nextDate;
}

export function ymdStockholm(date: Date): string {
	const parts = new Intl.DateTimeFormat('sv-SE', {
		timeZone: STOCKHOLM_TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	})
		.formatToParts(date)
		.reduce(
			(accumulator, part) => {
				accumulator[part.type] = part.value;
				return accumulator;
			},
			{} as Record<string, string>
		);

	return `${parts.year}-${parts.month}-${parts.day}`;
}

export function dayParam(date: Date) {
	return `${ymdStockholm(date)} 12:00:00`;
}

export function formatLongDate(date: Date): string {
	return date.toLocaleDateString('sv-SE', {
		timeZone: STOCKHOLM_TIME_ZONE,
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	});
}

export function formatCurrency(value: number | null) {
	if (!Number.isFinite(value ?? NaN)) return '–';
	return new Intl.NumberFormat('sv-SE', {
		style: 'currency',
		currency: 'SEK',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(value ?? 0);
}

export function relativeTime(value?: string | null) {
	if (!value) return '';

	const diff = Date.now() - new Date(value).getTime();
	const minutes = Math.floor(diff / 60000);

	if (minutes < 1) return 'just nu';
	if (minutes < 60) return `${minutes} min sen`;

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h sen`;

	const days = Math.floor(hours / 24);
	return `${days}d sen`;
}

export function sortNotificationEvents(events: HomeModernNotificationEvent[]) {
	return sortNotifications(events);
}

export function getClientFullName(client: HomeModernClient) {
	return [client.firstname, client.lastname].filter(Boolean).join(' ').trim();
}

export function isOverSixWeeksAgo(dateStr?: string | null) {
	if (!dateStr) return true;

	const lastDate = new Date(dateStr);
	const sixWeeksAgo = new Date();
	sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
	return lastDate < sixWeeksAgo;
}

export function getLastBookedText(dateStr?: string | null) {
	if (!dateStr) return 'Har aldrig bokats';

	const date = new Date(dateStr);
	return `Senast bokad ${date.toLocaleDateString('sv-SE', {
		timeZone: STOCKHOLM_TIME_ZONE,
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	})}`;
}
