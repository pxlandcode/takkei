import { writable } from 'svelte/store';

export type CurrentAbsence = {
	id: number;
	description?: string | null;
	start_time?: string | null;
	end_time?: string | null;
	status?: string | null;
	approved_by_id?: number | null;
};

const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ABSENCE_PROMPT_ACK_STORAGE_KEY = 'takkei.absence.prompt.ack';

export const ABSENCE_UPDATED_EVENT = 'takkei:absence-updated';

function readAcknowledgedAbsencePromptKey() {
	if (typeof window === 'undefined') return null;
	try {
		return window.sessionStorage.getItem(ABSENCE_PROMPT_ACK_STORAGE_KEY);
	} catch {
		return null;
	}
}

export const absencePromptAcknowledgedKey = writable<string | null>(
	readAcknowledgedAbsencePromptKey()
);

export function parseAbsenceBoundary(
	value: string | null | undefined,
	boundary: 'start' | 'end'
): Date | null {
	if (!value) return null;

	const trimmedValue = value.trim();
	if (!trimmedValue) return null;

	if (ISO_DATE_ONLY_RE.test(trimmedValue)) {
		return new Date(`${trimmedValue}T${boundary === 'start' ? '00:00:00' : '23:59:59.999'}`);
	}

	const parsed = new Date(trimmedValue);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveCurrentAbsence(absences: CurrentAbsence[]) {
	const now = new Date();

	return (
		absences.find((absence) => {
			const start = parseAbsenceBoundary(absence.start_time, 'start');
			const end = parseAbsenceBoundary(absence.end_time, 'end');

			if (!start) return false;
			if (start > now) return false;
			return !end || end >= now;
		}) ?? null
	);
}

export function buildCurrentAbsenceKey(userId: number, absence: CurrentAbsence) {
	return `${userId}:${absence.id}:${absence.start_time ?? ''}:${absence.end_time ?? ''}`;
}

export function dispatchAbsenceUpdated() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent(ABSENCE_UPDATED_EVENT));
}

export function acknowledgeAbsencePrompt(key: string) {
	absencePromptAcknowledgedKey.set(key);
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.setItem(ABSENCE_PROMPT_ACK_STORAGE_KEY, key);
	} catch {
		// ignore storage errors
	}
}

export function clearAcknowledgedAbsencePrompt() {
	absencePromptAcknowledgedKey.set(null);
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.removeItem(ABSENCE_PROMPT_ACK_STORAGE_KEY);
	} catch {
		// ignore storage errors
	}
}
