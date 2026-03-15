import { json, type RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';

const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function hasTextValue(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function normalizeAbsenceTimestamp(value: unknown): string | null {
	if (!hasTextValue(value)) return null;

	const trimmed = value.trim();
	if (ISO_DATE_ONLY_RE.test(trimmed)) {
		return trimmed;
	}

	const parsed = new Date(trimmed);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return trimmed;
}

function toDateKey(value: string): string | null {
	if (ISO_DATE_ONLY_RE.test(value)) {
		return value;
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return parsed.toISOString().slice(0, 10);
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();

	const { userId, description, startTime, endTime } = body;

	if (!userId) {
		console.warn('⚠️ Missing userId in request body');
		return json({ error: 'Missing userId' }, { status: 400 });
	}

	const trimmedDescription = typeof description === 'string' ? description.trim() : '';
	if (!trimmedDescription) {
		return json({ error: 'Description is required' }, { status: 400 });
	}

	const normalizedStartTime = normalizeAbsenceTimestamp(startTime);
	if (hasTextValue(startTime) && !normalizedStartTime) {
		return json({ error: 'Invalid startTime' }, { status: 400 });
	}

	const normalizedEndTime = normalizeAbsenceTimestamp(endTime);
	if (hasTextValue(endTime) && !normalizedEndTime) {
		return json({ error: 'Invalid endTime' }, { status: 400 });
	}

	const resolvedStartTime = normalizedStartTime ?? new Date().toISOString();
	const startDateKey = toDateKey(resolvedStartTime);
	const endDateKey = normalizedEndTime ? toDateKey(normalizedEndTime) : null;

	if (!startDateKey) {
		return json({ error: 'Invalid startTime' }, { status: 400 });
	}

	if (normalizedEndTime && (!endDateKey || endDateKey < startDateKey)) {
		return json({ error: 'endTime cannot be before startTime' }, { status: 400 });
	}

	try {
		const result = await query(
			`INSERT INTO absences (user_id, added_by_id, start_time, end_time, description, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
             RETURNING *`,
			[
				userId,
				userId,
				resolvedStartTime,
				normalizedEndTime,
				trimmedDescription,
				normalizedEndTime ? 'Closed' : 'Open'
			]
		);

		return json({ success: true, absence: result[0] });
	} catch (err) {
		console.error('❌ Failed to save absence:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');
	if (!id) return json({ error: 'Missing id' }, { status: 400 });

	try {
		await query(`DELETE FROM absences WHERE id = $1`, [id]);
		return json({ success: true });
	} catch (err) {
		console.error('❌ Failed to delete absence:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { absenceId, approverId, description, startTime, endTime, status, resetApproval } = body;

	if (!absenceId) {
		return json({ error: 'Missing absenceId' }, { status: 400 });
	}

	try {
		const hasDescription = Object.prototype.hasOwnProperty.call(body, 'description');
		const hasStartTime = Object.prototype.hasOwnProperty.call(body, 'startTime');
		const hasEndTime = Object.prototype.hasOwnProperty.call(body, 'endTime');
		const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status');

		let updateFields: string[] = [];
		let values: Array<string | number | null> = [];
		let counter = 1;

		const normalizedStartTime = hasStartTime ? normalizeAbsenceTimestamp(startTime) : null;
		if (hasStartTime && !normalizedStartTime) {
			return json({ error: 'Invalid startTime' }, { status: 400 });
		}

		const normalizedEndTime = hasEndTime ? normalizeAbsenceTimestamp(endTime) : null;
		if (hasEndTime && hasTextValue(endTime) && !normalizedEndTime) {
			return json({ error: 'Invalid endTime' }, { status: 400 });
		}

		if (hasStartTime || hasEndTime) {
			const existing = await query(`SELECT start_time, end_time FROM absences WHERE id = $1`, [
				absenceId
			]);
			const currentAbsence = existing[0];
			if (!currentAbsence) {
				return json({ error: 'Absence not found' }, { status: 404 });
			}

			const effectiveStartTime = hasStartTime ? normalizedStartTime : currentAbsence.start_time;
			const effectiveEndTime = hasEndTime ? normalizedEndTime : currentAbsence.end_time;
			const startDateKey = effectiveStartTime ? toDateKey(String(effectiveStartTime)) : null;
			const endDateKey = effectiveEndTime ? toDateKey(String(effectiveEndTime)) : null;

			if (!startDateKey) {
				return json({ error: 'Invalid startTime' }, { status: 400 });
			}

			if (endDateKey && endDateKey < startDateKey) {
				return json({ error: 'endTime cannot be before startTime' }, { status: 400 });
			}
		}

		if (hasDescription) {
			const trimmedDescription = typeof description === 'string' ? description.trim() : '';
			if (!trimmedDescription) {
				return json({ error: 'Description is required' }, { status: 400 });
			}

			updateFields.push(`description = $${counter++}`);
			values.push(trimmedDescription);
		}

		if (hasStartTime) {
			updateFields.push(`start_time = $${counter++}`);
			values.push(normalizedStartTime);
		}

		if (hasEndTime) {
			updateFields.push(`end_time = $${counter++}`);
			values.push(normalizedEndTime);
		}

		if (resetApproval === true) {
			updateFields.push(`approved_by_id = NULL`);
		} else if (approverId) {
			updateFields.push(`approved_by_id = $${counter++}`);
			values.push(approverId);
		}

		if (hasStatus && status) {
			updateFields.push(`status = $${counter++}`);
			values.push(status);
		}

		if (updateFields.length === 0) {
			return json({ error: 'No fields to update' }, { status: 400 });
		}

		values.push(absenceId);

		const result = await query(
			`UPDATE absences
			 SET ${updateFields.join(', ')}, updated_at = NOW()
			 WHERE id = $${counter}
			 RETURNING *`,
			values
		);

		return json({ success: true, absence: result[0] });
	} catch (err) {
		console.error('❌ Failed to update absence:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
