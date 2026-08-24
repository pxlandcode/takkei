import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { query } from '$lib/db';
import type { ClientCalendarEvent } from '$lib/helpers/calendarHelpers/client-calendar-ics';

const TOKEN_SEPARATOR = '.';
const DEFAULT_PAST_MONTHS = 12;
const DEFAULT_FUTURE_MONTHS = 24;

type AuthUserLike = {
	kind?: 'trainer' | 'client' | string;
	trainerId?: number | null;
	trainer_id?: number | null;
	clientId?: number | null;
	client_id?: number | null;
};

export type ClientCalendarSubscription = {
	id: number;
	clientId: number;
	nonce: string;
	createdAt: string | Date;
};

export type ClientCalendarSubscriptionLinks = {
	feedUrl: string;
	webcalUrl: string;
	syncPageUrl: string;
	bookingsPageUrl: string;
};

function getCalendarFeedSecret(): string {
	const secret = process.env.CALENDAR_FEED_SECRET;
	if (!secret || secret.length < 32) {
		throw new Error('CALENDAR_FEED_SECRET must be set to at least 32 characters');
	}
	return secret;
}

function hmacBase64Url(input: string, secret = getCalendarFeedSecret()): string {
	return createHmac('sha256', secret).update(input).digest('base64url');
}

function signaturesMatch(actual: string, expected: string): boolean {
	const actualBuffer = Buffer.from(actual);
	const expectedBuffer = Buffer.from(expected);
	return (
		actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
	);
}

function normalizeSubscriptionRow(row: any): ClientCalendarSubscription {
	return {
		id: Number(row.id),
		clientId: Number(row.client_id),
		nonce: row.nonce,
		createdAt: row.created_at
	};
}

function addMonths(date: Date, months: number): Date {
	const copy = new Date(date);
	copy.setMonth(copy.getMonth() + months);
	return copy;
}

export function signClientCalendarToken(
	subscriptionId: number,
	nonce: string,
	secret = getCalendarFeedSecret()
): string {
	const unsigned = `${subscriptionId}${TOKEN_SEPARATOR}${nonce}`;
	return `${unsigned}${TOKEN_SEPARATOR}${hmacBase64Url(unsigned, secret)}`;
}

export function parseSignedClientCalendarToken(
	token: string,
	secret = getCalendarFeedSecret()
): { subscriptionId: number; nonce: string } | null {
	const parts = token.split(TOKEN_SEPARATOR);
	if (parts.length !== 3) return null;

	const [rawSubscriptionId, nonce, signature] = parts;
	const subscriptionId = Number(rawSubscriptionId);
	if (!Number.isInteger(subscriptionId) || subscriptionId <= 0 || !nonce || !signature) {
		return null;
	}

	const unsigned = `${subscriptionId}${TOKEN_SEPARATOR}${nonce}`;
	const expected = hmacBase64Url(unsigned, secret);
	if (!signaturesMatch(signature, expected)) return null;

	return { subscriptionId, nonce };
}

export function buildClientCalendarSubscriptionToken(
	subscription: Pick<ClientCalendarSubscription, 'id' | 'nonce'>
): string {
	return signClientCalendarToken(subscription.id, subscription.nonce);
}

export function buildClientCalendarSubscriptionLinks({
	origin,
	token
}: {
	origin: string;
	token: string;
}): ClientCalendarSubscriptionLinks {
	const encodedToken = encodeURIComponent(token);
	const feedUrl = new URL(`/calendar/client/${encodedToken}.ics`, origin).toString();
	const syncPageUrl = new URL(`/calendar-sync/${encodedToken}`, origin).toString();
	const bookingsPageUrl = new URL(`/calendar-bookings/${encodedToken}`, origin).toString();
	const webcalUrl = feedUrl.replace(/^https?:/i, 'webcal:');

	return { feedUrl, webcalUrl, syncPageUrl, bookingsPageUrl };
}

export function getClientCalendarActorId(authUser: AuthUserLike | null | undefined): number | null {
	if (authUser?.kind !== 'trainer') return null;
	const trainerId = authUser.trainerId ?? authUser.trainer_id ?? null;
	return typeof trainerId === 'number' && Number.isFinite(trainerId) ? trainerId : null;
}

async function assertClientCanHaveCalendarFeed(clientId: number) {
	const rows = await query(
		`
		SELECT clients.id
		FROM clients
		LEFT JOIN gdpr_profile_lifecycle lifecycle
		  ON lifecycle.profile_type = 'client'
		 AND lifecycle.client_id = clients.id
		WHERE clients.id = $1
		  AND lifecycle.gdpr_deleted_at IS NULL
		`,
		[clientId]
	);

	if (!rows.length) {
		const error = new Error('Client not found');
		(error as any).status = 404;
		throw error;
	}
}

async function getActiveClientCalendarSubscription(
	clientId: number
): Promise<ClientCalendarSubscription | null> {
	const rows = await query(
		`
		SELECT id, client_id, nonce, created_at
		FROM client_calendar_subscriptions
		WHERE client_id = $1
		  AND revoked_at IS NULL
		LIMIT 1
		`,
		[clientId]
	);

	return rows[0] ? normalizeSubscriptionRow(rows[0]) : null;
}

export async function createOrReuseClientCalendarSubscription({
	clientId,
	createdByUserId,
	rotate = false
}: {
	clientId: number;
	createdByUserId: number | null;
	rotate?: boolean;
}): Promise<ClientCalendarSubscription> {
	await assertClientCanHaveCalendarFeed(clientId);

	if (rotate) {
		await query(
			`
			UPDATE client_calendar_subscriptions
			SET revoked_at = NOW()
			WHERE client_id = $1
			  AND revoked_at IS NULL
			`,
			[clientId]
		);
	} else {
		const existing = await getActiveClientCalendarSubscription(clientId);
		if (existing) return existing;
	}

	const nonce = randomBytes(24).toString('base64url');

	try {
		const rows = await query(
			`
			INSERT INTO client_calendar_subscriptions (client_id, nonce, created_by_user_id)
			VALUES ($1, $2, $3)
			RETURNING id, client_id, nonce, created_at
			`,
			[clientId, nonce, createdByUserId]
		);

		return normalizeSubscriptionRow(rows[0]);
	} catch (error) {
		if ((error as any)?.code === '23505') {
			const existing = await getActiveClientCalendarSubscription(clientId);
			if (existing) return existing;
		}

		throw error;
	}
}

export async function createOrReuseClientCalendarSubscriptionLinks({
	clientId,
	createdByUserId,
	origin,
	rotate = false
}: {
	clientId: number;
	createdByUserId: number | null;
	origin: string;
	rotate?: boolean;
}): Promise<ClientCalendarSubscriptionLinks> {
	const subscription = await createOrReuseClientCalendarSubscription({
		clientId,
		createdByUserId,
		rotate
	});
	const token = buildClientCalendarSubscriptionToken(subscription);
	return buildClientCalendarSubscriptionLinks({ origin, token });
}

export async function getActiveClientCalendarSubscriptionFromToken(
	token: string
): Promise<ClientCalendarSubscription | null> {
	const parsed = parseSignedClientCalendarToken(token);
	if (!parsed) return null;

	const rows = await query(
		`
		SELECT subscriptions.id,
		       subscriptions.client_id,
		       subscriptions.nonce,
		       subscriptions.created_at
		FROM client_calendar_subscriptions subscriptions
		INNER JOIN clients ON clients.id = subscriptions.client_id
		LEFT JOIN gdpr_profile_lifecycle lifecycle
		  ON lifecycle.profile_type = 'client'
		 AND lifecycle.client_id = clients.id
		WHERE subscriptions.id = $1
		  AND subscriptions.nonce = $2
		  AND subscriptions.revoked_at IS NULL
		  AND lifecycle.gdpr_deleted_at IS NULL
		LIMIT 1
		`,
		[parsed.subscriptionId, parsed.nonce]
	);

	return rows[0] ? normalizeSubscriptionRow(rows[0]) : null;
}

export async function markClientCalendarSubscriptionAccessed(
	subscriptionId: number
): Promise<void> {
	try {
		await query(
			`
			UPDATE client_calendar_subscriptions
			SET last_accessed_at = NOW()
			WHERE id = $1
			`,
			[subscriptionId]
		);
	} catch (error) {
		console.warn('Failed to update client calendar subscription access time', error);
	}
}

export async function getClientCalendarFeedEvents(
	clientId: number
): Promise<ClientCalendarEvent[]> {
	const now = new Date();
	const from = addMonths(now, -DEFAULT_PAST_MONTHS);
	const to = addMonths(now, DEFAULT_FUTURE_MONTHS);

	const rows = await query(
		`
		SELECT bookings.id,
		       bookings.status,
		       bookings.start_time,
		       bookings.created_at,
		       bookings.updated_at,
		       locations.name AS location_name,
		       booking_contents.id AS booking_content_id,
		       booking_contents.kind AS booking_content_kind
		FROM bookings
		LEFT JOIN locations ON locations.id = bookings.location_id
		LEFT JOIN booking_contents ON booking_contents.id = bookings.booking_content_id
		WHERE bookings.client_id = $1
		  AND bookings.start_time >= $2
		  AND bookings.start_time <= $3
		ORDER BY bookings.start_time ASC, bookings.id ASC
		`,
		[clientId, from, to]
	);

	return rows.map((row: any) => ({
		id: Number(row.id),
		status: row.status ?? null,
		startTime: row.start_time,
		endTime: null,
		createdAt: row.created_at ?? null,
		updatedAt: row.updated_at ?? null,
		locationName: row.location_name ?? null,
		bookingContentId: row.booking_content_id == null ? null : Number(row.booking_content_id),
		bookingContentKind: row.booking_content_kind ?? null
	}));
}
