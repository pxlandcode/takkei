import { createHash } from 'crypto';

export function respondJsonWithEtag(
	request: Request,
	data: unknown,
	init: ResponseInit = {}
): Response {
	const body = JSON.stringify(data);
	const etag = `"${createHash('sha1').update(body).digest('hex')}"`;
	const headers = new Headers(init.headers);
	headers.set('Content-Type', 'application/json');
	headers.set('ETag', etag);

	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304, headers });
	}

	return new Response(body, { status: init.status ?? 200, headers });
}
