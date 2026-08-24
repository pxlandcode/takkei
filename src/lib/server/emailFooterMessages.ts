import { randomInt } from 'crypto';
import { query } from '$lib/db';
import type { EmailFooterMessage } from '$lib/types/emailFooterMessage';

export const FALLBACK_EMAIL_FOOTER_MESSAGES = [
	'En timme i veckan\nHela kroppen\nRepetera',
	'Kontinuitet är nyckeln till träningsframgång',
	'Smärtfri\nSmidig\nStark\nSnabb\n(Snygg)'
];

type NormalizedEmailFooterMessage = {
	message: string;
	active: boolean;
};

export type EmailFooterMessageValidationResult = {
	errors: Record<string, string>;
	values: NormalizedEmailFooterMessage;
};

export type EmailFooterMessageRow = {
	id: number;
	message: string;
	active: boolean;
	created_at: string | null;
	updated_at: string | null;
};

function normalizeString(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value.trim();
}

function normalizeActive(value: unknown): boolean {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
		if (['false', '0', 'no', 'off'].includes(normalized)) return false;
	}
	return true;
}

function toIso(value: string | null): string | null {
	if (!value) return null;
	const parsed = new Date(value);
	if (!Number.isNaN(parsed.getTime())) {
		return parsed.toISOString();
	}
	return value;
}

export function validateEmailFooterMessagePayload(
	payload: Record<string, unknown>
): EmailFooterMessageValidationResult {
	const errors: Record<string, string> = {};
	const message = normalizeString(payload.message);

	if (!message) {
		errors.message = 'Meddelande krävs';
	}

	return {
		errors,
		values: {
			message,
			active: normalizeActive(payload.active)
		}
	};
}

export function mapEmailFooterMessageRow(row: EmailFooterMessageRow): EmailFooterMessage {
	return {
		id: Number(row.id),
		message: normalizeString(row.message),
		active: Boolean(row.active),
		createdAt: toIso(row.created_at),
		updatedAt: toIso(row.updated_at)
	};
}

export function splitEmailFooterMessageLines(message: string | null | undefined): string[] {
	if (!message) return [];
	return message
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

function pickRandomMessage(messages: string[]): string {
	return messages[randomInt(messages.length)];
}

export function getFallbackEmailFooterLines(): string[] {
	return splitEmailFooterMessageLines(pickRandomMessage(FALLBACK_EMAIL_FOOTER_MESSAGES));
}

export async function getActiveEmailFooterLinesForEmail(): Promise<string[] | null> {
	try {
		const rows = await query<EmailFooterMessageRow>(
			`SELECT id, message, active, created_at, updated_at
			 FROM email_footer_messages
			 WHERE active = TRUE
			 ORDER BY created_at DESC, id DESC`
		);

		if (!rows.length) return null;

		const messages = rows.map((row) => normalizeString(row.message)).filter(Boolean);
		if (!messages.length) return null;

		return splitEmailFooterMessageLines(pickRandomMessage(messages));
	} catch (error) {
		console.warn('Failed to load email footer messages; using fallback messages', error);
		return getFallbackEmailFooterLines();
	}
}
