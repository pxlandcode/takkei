const SIGNUP_HOSTS = new Set(['signup.takkei.se']);

export function isSignupHost(urlOrHostname: URL | string): boolean {
	const hostname = typeof urlOrHostname === 'string' ? urlOrHostname : urlOrHostname.hostname;
	return SIGNUP_HOSTS.has(hostname.toLowerCase());
}
