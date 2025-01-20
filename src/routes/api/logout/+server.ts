export async function POST({ cookies }) {
	// Clear the session cookie
	cookies.delete('session', { path: '/' });
	return new Response(null, { status: 204 });
}
