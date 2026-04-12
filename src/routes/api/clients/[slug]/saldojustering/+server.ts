import { json, type RequestHandler } from '@sveltejs/kit';
import * as db from '$lib/db';
import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import { resolvePackageAssignmentForCreate } from '$lib/server/createBookingPackageAssignment';
import { getStockholmYmd } from '$lib/server/packageSemantics';
import { enqueuePackageReallocation } from '$lib/server/scheduledItems';
import type { PoolClient } from 'pg';

type SqlClient = Pick<PoolClient, 'query'>;

const MAX_ADJUSTMENTS_PER_REQUEST = 100;
const SALDO_BOOKING_CONTENT_ID = 1;

const pool = (db as any).pool as { connect: () => Promise<PoolClient> };

function toPositiveInt(value: unknown): number | null {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) return null;
	return parsed;
}

function normalizeDateInput(value: unknown) {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function trainerIdFromUser(authUser: App.Locals['user']) {
	if (!authUser || authUser.kind !== 'trainer') return null;
	const trainerId = authUser.trainerId ?? (authUser as any).trainer_id ?? null;
	return typeof trainerId === 'number' && Number.isInteger(trainerId) ? trainerId : null;
}

async function txQuery(client: SqlClient, text: string, params: unknown[] = []) {
	return (await (db as any).queryWithClient(client as PoolClient, text, params)) as any[];
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) {
		return json({ error: admin.message }, { status: admin.status });
	}

	const clientId = Number(params.slug);
	if (!Number.isInteger(clientId) || clientId <= 0) {
		return json({ error: 'Ogiltigt klient-id' }, { status: 400 });
	}

	const trainerId = trainerIdFromUser(admin.authUser);
	if (!trainerId) {
		return json({ error: 'Endast tränare kan skapa saldojusteringar' }, { status: 403 });
	}

	let body: any = {};
	try {
		body = await request.json();
	} catch {
		body = {};
	}

	const bookingDate = normalizeDateInput(body?.date);
	if (!bookingDate) {
		return json({ error: 'Datum måste anges som YYYY-MM-DD' }, { status: 400 });
	}

	const count = toPositiveInt(body?.count ?? body?.quantity ?? body?.sessions);
	if (!count || count > MAX_ADJUSTMENTS_PER_REQUEST) {
		return json(
			{ error: `Antal måste vara mellan 1 och ${MAX_ADJUSTMENTS_PER_REQUEST}` },
			{ status: 400 }
		);
	}

	const explicitPackageId = toPositiveInt(body?.package_id ?? body?.packageId);

	const startTime = `${bookingDate} 03:00:00`;
	const checkYmd = getStockholmYmd(startTime);
	if (!checkYmd) {
		return json({ error: 'Kunde inte tolka valt datum' }, { status: 400 });
	}

	const client = await pool.connect();
	let inTx = false;

	try {
		await client.query('BEGIN');
		inTx = true;

		const existingClient = await txQuery(client, `SELECT id FROM clients WHERE id = $1`, [
			clientId
		]);
		if (!existingClient.length) {
			await client.query('ROLLBACK');
			inTx = false;
			return json({ error: 'Klienten hittades inte' }, { status: 404 });
		}

		const created: Array<{ id: number; package_id: number }> = [];

		for (let index = 0; index < count; index += 1) {
			const packageAssignment = await resolvePackageAssignmentForCreate({
				client,
				clientId,
				explicitPackageId,
				bookingNeedsPackage: true,
				bookingIsChargeable: true,
				checkYmd,
				initialAddedToPackageDate: null
			});

			if (!packageAssignment.packageId) {
				await client.query('ROLLBACK');
				inTx = false;
				return json(
					{
						error: explicitPackageId
							? 'Det valda paketet är inte giltigt eller har inte tillräckligt saldo för hela justeringen.'
							: 'Det finns inget giltigt paket med tillräckligt saldo för hela justeringen.',
						createdCount: 0
					},
					{ status: 422 }
				);
			}

			const rows = await txQuery(
				client,
				`
				INSERT INTO bookings (
					client_id,
					package_id,
					room_id,
					trainer_id,
					status,
					start_time,
					location_id,
					created_by_id,
					booking_content_id,
					try_out,
					internal,
					education,
					booking_without_room,
					internal_education,
					added_to_package_date,
					added_to_package_by,
					created_at,
					updated_at
				)
				VALUES (
					$1,
					$2,
					NULL,
					$3,
					'New',
					$4,
					NULL,
					$3,
					$5,
					FALSE,
					FALSE,
					FALSE,
					TRUE,
					FALSE,
					$6,
					$7,
					NOW(),
					NOW()
				)
				RETURNING id, package_id
				`,
				[
					clientId,
					packageAssignment.packageId,
					trainerId,
					startTime,
					SALDO_BOOKING_CONTENT_ID,
					packageAssignment.addedToPackageDate,
					String(trainerId)
				]
			);

			created.push({
				id: Number(rows[0].id),
				package_id: Number(rows[0].package_id)
			});
		}

		await enqueuePackageReallocation({
			client,
			clientId,
			createdByEvent: 'saldojustering'
		});

		await client.query('COMMIT');
		inTx = false;

		return json(
			{
				ok: true,
				createdCount: created.length,
				bookingIds: created.map((item) => item.id),
				packageIds: Array.from(new Set(created.map((item) => item.package_id)))
			},
			{ status: 201 }
		);
	} catch (error) {
		if (inTx) {
			try {
				await client.query('ROLLBACK');
			} catch (rollbackError) {
				console.error('Failed rollback during saldojustering create:', rollbackError);
			}
		}

		console.error('Failed to create saldojustering:', error);
		return json(
			{ error: (error as Error)?.message || 'Kunde inte skapa saldojustering' },
			{ status: 500 }
		);
	} finally {
		client.release();
	}
};
