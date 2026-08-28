import { i18n } from '$lib/i18n';
import { isSignupHost } from '$lib/signupHosts';
import type { Reroute } from '@sveltejs/kit';

const i18nReroute = i18n.reroute();

export const reroute: Reroute = (event) => {
	if (isSignupHost(event.url) && event.url.pathname === '/') {
		return '/signup';
	}

	return i18nReroute(event);
};
