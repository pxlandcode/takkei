import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/db';
import { resolveAdministratorRequest } from '$lib/server/adminAccess';

function resolveTrainerId(user: App.Locals['user']) {
	if (!user || user.kind !== 'trainer') return null;
	return Number(user.trainerId ?? 0) || null;
}

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function normalizeNoteHtml(text: string) {
	const trimmed = text.trim();
	if (!trimmed) return '';

	// Keep Quill-produced HTML as-is; fall back to a basic paragraph for plain text payloads.
	if (/<[a-z][\s\S]*>/i.test(trimmed)) {
		return trimmed;
	}

	return `<p>${escapeHtml(trimmed).replaceAll('\n', '<br>')}</p>`;
}

function hasVisibleContent(text: string) {
	const plain = text
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.trim();

	return plain.length > 0;
}

async function ensurePackageExists(packageId: number) {
	const rows = await query(`SELECT id FROM packages WHERE id = $1`, [packageId]);
	return rows.length > 0;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const packageId = Number(params.id);
	if (!packageId || Number.isNaN(packageId)) {
		throw error(400, 'Ogiltigt paket-ID');
	}

	if (!resolveTrainerId(locals.user)) {
		throw error(403, 'Forbidden');
	}

	if (!(await ensurePackageExists(packageId))) {
		throw error(404, 'Paketet hittades inte');
	}

	try {
		const rows = await query(
			`
				SELECT
					n.id,
					n.target_id,
					n.target_type,
					n.writer_id,
					n.text,
					n.status,
					n.created_at,
					n.updated_at,
					u.firstname AS writer_firstname,
					u.lastname AS writer_lastname
				FROM notes n
				LEFT JOIN users u ON u.id = n.writer_id
				WHERE n.target_id = $1
				  AND n.target_type = 'Package'
				ORDER BY n.created_at DESC
			`,
			[packageId]
		);

		return json(
			rows.map((row) => ({
				...row,
				writer: row.writer_id
					? {
							id: row.writer_id,
							firstname: row.writer_firstname ?? null,
							lastname: row.writer_lastname ?? null
						}
					: null
			}))
		);
	} catch (err) {
		console.error('Error fetching package notes:', err);
		throw error(500, 'Internal Server Error');
	}
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const packageId = Number(params.id);
	if (!packageId || Number.isNaN(packageId)) {
		throw error(400, 'Ogiltigt paket-ID');
	}

	const adminRequest = await resolveAdministratorRequest(locals);
	if (!adminRequest.ok) {
		throw error(adminRequest.status, adminRequest.message);
	}

	const writerId = resolveTrainerId(adminRequest.authUser);
	if (!writerId) {
		throw error(403, 'Forbidden');
	}

	if (!(await ensurePackageExists(packageId))) {
		throw error(404, 'Paketet hittades inte');
	}

	const body = await request.json();
	const rawText = typeof body?.text === 'string' ? body.text : '';
	const normalizedText = normalizeNoteHtml(rawText);

	if (!normalizedText || !hasVisibleContent(normalizedText)) {
		throw error(400, 'Text krävs');
	}

	try {
		const inserted = await query(
			`
				INSERT INTO notes (target_id, target_type, writer_id, text, status, created_at, updated_at)
				VALUES ($1, 'Package', $2, $3, 'new', NOW(), NOW())
				RETURNING id, target_id, target_type, writer_id, text, status, created_at, updated_at
			`,
			[packageId, writerId, normalizedText]
		);

		const note = inserted[0];
		return json(
			{
				...note,
				writer: {
					id: writerId,
					firstname: adminRequest.authUser.firstname ?? null,
					lastname: adminRequest.authUser.lastname ?? null
				}
			},
			{ status: 201 }
		);
	} catch (err) {
		console.error('Error creating package note:', err);
		throw error(500, 'Internal Server Error');
	}
};
