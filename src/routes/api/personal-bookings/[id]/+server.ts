import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';

function isMeetingKind(kind: string | null | undefined) {
	if (!kind) return false;
	const normalized = kind
		.toLowerCase()
		.replace('ö', 'o')
		.replace('ø', 'o')
		.replace('ó', 'o');
	return normalized.includes('meeting') || normalized.includes('mote');
}

function resolveActorUserId(authUser: App.Locals['user'] | null): number | null {
	if (!authUser) return null;
	if (authUser.kind === 'trainer') {
		return typeof authUser.trainerId === 'number' ? authUser.trainerId : null;
	}
	if (authUser.kind === 'client') {
		return typeof authUser.clientId === 'number' ? authUser.clientId : null;
	}
	return null;
}

function collectParticipantIds(primaryId: unknown, list: unknown): number[] {
	const ids = new Set<number>();
	const add = (value: unknown) => {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) ids.add(parsed);
	};

	add(primaryId);
	if (Array.isArray(list)) {
		list.forEach(add);
	}

	return Array.from(ids);
}

export const DELETE: RequestHandler = async ({ params, url, locals }) => {
	const idParam = params.id;
	const bookingId = Number(idParam);
	const scope = url.searchParams.get('scope') === 'self' ? 'self' : 'all';

	if (!bookingId || Number.isNaN(bookingId)) {
		return json({ error: 'Ogiltigt boknings-ID' }, { status: 400 });
	}

	const actorUserId = resolveActorUserId(locals.user ?? null);
	if (!actorUserId || Number.isNaN(actorUserId)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const existing = await query(
			`SELECT id, kind, user_id, user_ids, booked_by_id FROM personal_bookings WHERE id = $1`,
			[bookingId]
		);

		if (!existing || existing.length === 0) {
			return json({ error: 'Bokningen kunde inte hittas' }, { status: 404 });
		}

		const booking = existing[0];
		const isMeeting = isMeetingKind(booking.kind);
		const ownerId =
			booking.booked_by_id === null || booking.booked_by_id === undefined
				? null
				: Number(booking.booked_by_id);

		if (scope === 'self') {
			if (!isMeeting) {
				return json({ error: 'Du kan bara lämna möten.' }, { status: 400 });
			}

			const participantIds = collectParticipantIds(booking.user_id, booking.user_ids);
			if (!participantIds.includes(actorUserId)) {
				return json({ error: 'Du är inte deltagare i detta möte.' }, { status: 403 });
			}

			const remainingParticipantIds = participantIds.filter((id) => id !== actorUserId);

			if (remainingParticipantIds.length === 0) {
				await query(`DELETE FROM personal_bookings WHERE id = $1`, [bookingId]);
				return json({
					success: true,
					action: 'deleted',
					message: 'Du togs bort från mötet. Inga deltagare återstod, så mötet togs bort.'
				});
			}

			const currentPrimaryUserId =
				booking.user_id === null || booking.user_id === undefined ? null : Number(booking.user_id);
			const nextPrimaryUserId =
				currentPrimaryUserId === null || currentPrimaryUserId === actorUserId
					? remainingParticipantIds[0]
					: currentPrimaryUserId;

			await query(
				`
				UPDATE personal_bookings
				SET user_id = $2,
					user_ids = $3::int[],
					updated_at = NOW()
				WHERE id = $1
				`,
				[bookingId, nextPrimaryUserId, remainingParticipantIds]
			);

			return json({
				success: true,
				action: 'left',
				message: 'Du har tagits bort från mötet.'
			});
		}

		if (isMeeting && ownerId !== null && ownerId !== actorUserId) {
			return json(
				{ error: 'Endast mötesägaren kan avboka mötet för alla deltagare.' },
				{ status: 403 }
			);
		}

		await query(`DELETE FROM personal_bookings WHERE id = $1`, [bookingId]);

		return json({ success: true });
	} catch (err) {
		console.error('🔥 Error deleting personal booking:', err);
		return json({ error: 'Kunde inte ta bort bokningen' }, { status: 500 });
	}
};
