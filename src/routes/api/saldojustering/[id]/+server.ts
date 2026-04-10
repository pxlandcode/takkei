import { json, type RequestHandler } from '@sveltejs/kit';
import * as db from '$lib/db';
import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import { isSaldoAdjustmentBooking } from '$lib/server/packageSemantics';
import { enqueuePackageReallocation } from '$lib/server/scheduledItems';
import type { PoolClient } from 'pg';

type SqlClient = Pick<PoolClient, 'query'>;

const pool = (db as any).pool as { connect: () => Promise<PoolClient> };

function trainerIdFromUser(authUser: App.Locals['user']) {
	if (!authUser || authUser.kind !== 'trainer') return null;
	const trainerId = authUser.trainerId ?? (authUser as any).trainer_id ?? null;
	return typeof trainerId === 'number' && Number.isInteger(trainerId) ? trainerId : null;
}

async function txQuery(client: SqlClient, text: string, params: unknown[] = []) {
	return (await (db as any).queryWithClient(client as PoolClient, text, params)) as any[];
}

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) {
		return json({ error: admin.message }, { status: admin.status });
	}

	const bookingId = Number(params.id);
	if (!Number.isInteger(bookingId) || bookingId <= 0) {
		return json({ error: 'Ogiltigt boknings-id' }, { status: 400 });
	}

	const trainerId = trainerIdFromUser(admin.authUser);
	if (!trainerId) {
		return json({ error: 'Endast tränare kan ta bort saldojusteringar' }, { status: 403 });
	}

	const client = await pool.connect();
	let inTx = false;

	try {
		await client.query('BEGIN');
		inTx = true;

		const rows = await txQuery(
			client,
			`
			SELECT id, client_id, room_id, start_time
			FROM bookings
			WHERE id = $1
			FOR UPDATE
			`,
			[bookingId]
		);

		if (!rows.length) {
			await client.query('ROLLBACK');
			inTx = false;
			return json({ error: 'Saldojusteringen hittades inte' }, { status: 404 });
		}

		const booking = rows[0];
		if (
			!isSaldoAdjustmentBooking({
				room_id: booking.room_id,
				start_time: booking.start_time
			})
		) {
			await client.query('ROLLBACK');
			inTx = false;
			return json(
				{ error: 'Endast bokningar utan rum kl. 03:00 Stockholm kan tas bort här' },
				{ status: 400 }
			);
		}

		await txQuery(client, `DELETE FROM bookings WHERE id = $1`, [bookingId]);

		const clientId = Number(booking.client_id);
		if (Number.isInteger(clientId) && clientId > 0) {
			await enqueuePackageReallocation({
				client,
				clientId,
				createdByEvent: 'saldojustering_delete'
			});
		}

		await client.query('COMMIT');
		inTx = false;

		return json({ ok: true });
	} catch (error) {
		if (inTx) {
			try {
				await client.query('ROLLBACK');
			} catch (rollbackError) {
				console.error('Failed rollback during saldojustering delete:', rollbackError);
			}
		}

		console.error('Failed to delete saldojustering:', error);
		return json(
			{ error: (error as Error)?.message || 'Kunde inte ta bort saldojusteringen' },
			{ status: 500 }
		);
	} finally {
		client.release();
	}
};
