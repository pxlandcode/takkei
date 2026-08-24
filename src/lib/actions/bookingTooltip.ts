import { tick } from 'svelte';
import type { FullBooking } from '$lib/types/calendarTypes';
import { resolveBookingContentIcon } from '$lib/helpers/bookingContentIcons';

/** Params for the bookingTooltip action. */
export interface BookingTooltipParams {
	booking: FullBooking;
	preferred?: 'bottom' | 'top' | 'left' | 'right';
	delay?: number;
}

export function bookingTooltip(node: HTMLElement, params: BookingTooltipParams | null = null) {
	let tooltipEl: HTMLDivElement | null = null;

	let visible = false;
	let showTimer: ReturnType<typeof setTimeout> | null = null;
	let booking: FullBooking | null = null;
	let preferred: BookingTooltipParams['preferred'] = 'bottom';
	let delay = 0;
	let enabled = false;
	let destroyed = false;

	// Event Handlers
	function onMouseEnter() {
		if (!enabled || destroyed) return;

		if (!visible) {
			showTimer = setTimeout(() => {
				show();
			}, delay);
		}
	}

	function onMouseLeave() {
		if (destroyed) return;
		if (showTimer) {
			clearTimeout(showTimer);
			showTimer = null;
		}

		if (visible) {
			hide();
		}
	}

	// Show Tooltip
	function show() {
		if (!enabled || !booking || destroyed) return;

		visible = true;
		createTooltip();
	}

	// Hide Tooltip
	function hide() {
		if (destroyed) return;
		if (showTimer) {
			clearTimeout(showTimer);
			showTimer = null;
		}

		visible = false;
		removeTooltip();
	}

	// Create Tooltip
	async function createTooltip() {
		if (!visible || tooltipEl || !booking || destroyed) return;
		if (!node.isConnected) return;

		tooltipEl = document.createElement('div');
		tooltipEl.className =
			'fixed z-[9999] transition-opacity duration-100 opacity-0 pointer-events-none';

		const content = generateBookingContent(booking);

		tooltipEl.innerHTML = `
      <div class="relative bg-white text-gray-900 rounded-sm shadow-xl border border-gray-200 max-w-sm">
        ${content}
      </div>
    `;

		document.body.appendChild(tooltipEl);

		await tick();
		if (destroyed || !visible || !tooltipEl || !node.isConnected) {
			removeTooltip();
			return;
		}
		positionTooltip();
		tooltipEl.style.opacity = '1';
	}

	// Remove Tooltip
	function removeTooltip() {
		if (tooltipEl) {
			tooltipEl.remove();
			tooltipEl = null;
		}
	}

	// Generate booking content HTML
	function generateBookingContent(booking: FullBooking): string {
		if (booking.isPersonalBooking) {
			return generatePersonalBookingContent(booking);
		}
		return generateRegularBookingContent(booking);
	}

	function formatDateTime(isoString: string): string {
		const date = new Date(isoString);
		return date.toLocaleDateString('sv-SE', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatTime(isoString: string): string {
		const date = new Date(isoString);
		return date.toLocaleTimeString('sv-SE', {
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function escapeHtml(text: string | null | undefined): string {
		if (!text) return '';
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	// SVG icons using your icon components' paths
	const svgIcon = {
		clock: `<svg width="16" height="16" fill="currentColor" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M26.6 29.4L29.4 26.6L22 19.2V10H18V20.8L26.6 29.4ZM20 40C17.2333 40 14.6333 39.475 12.2 38.425C9.76667 37.375 7.65 35.95 5.85 34.15C4.05 32.35 2.625 30.2333 1.575 27.8C0.525 25.3667 0 22.7667 0 20C0 17.2333 0.525 14.6333 1.575 12.2C2.625 9.76667 4.05 7.65 5.85 5.85C7.65 4.05 9.76667 2.625 12.2 1.575C14.6333 0.525 17.2333 0 20 0C22.7667 0 25.3667 0.525 27.8 1.575C30.2333 2.625 32.35 4.05 34.15 5.85C35.95 7.65 37.375 9.76667 38.425 12.2C39.475 14.6333 40 17.2333 40 20C40 22.7667 39.475 25.3667 38.425 27.8C37.375 30.2333 35.95 32.35 34.15 34.15C32.35 35.95 30.2333 37.375 27.8 38.425C25.3667 39.475 22.7667 40 20 40ZM20 36C24.4333 36 28.2083 34.4417 31.325 31.325C34.4417 28.2083 36 24.4333 36 20C36 15.5667 34.4417 11.7917 31.325 8.675C28.2083 5.55833 24.4333 4 20 4C15.5667 4 11.7917 5.55833 8.675 8.675C5.55833 11.7917 4 15.5667 4 20C4 24.4333 5.55833 28.2083 8.675 31.325C11.7917 34.4417 15.5667 36 20 36Z"/></svg>`,
		person: `<svg width="16" height="16" fill="currentColor" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M20 20C17.25 20 14.8958 19.0208 12.9375 17.0625C10.9792 15.1042 10 12.75 10 10C10 7.25 10.9792 4.89583 12.9375 2.9375C14.8958 0.979167 17.25 0 20 0C22.75 0 25.1042 0.979167 27.0625 2.9375C29.0208 4.89583 30 7.25 30 10C30 12.75 29.0208 15.1042 27.0625 17.0625C25.1042 19.0208 22.75 20 20 20ZM0 40V33C0 31.5833 0.364583 30.2812 1.09375 29.0938C1.82292 27.9062 2.79167 27 4 26.375C6.58333 25.0833 9.20833 24.1146 11.875 23.4688C14.5417 22.8229 17.25 22.5 20 22.5C22.75 22.5 25.4583 22.8229 28.125 23.4688C30.7917 24.1146 33.4167 25.0833 36 26.375C37.2083 27 38.1771 27.9062 38.9062 29.0938C39.6354 30.2812 40 31.5833 40 33V40H0ZM5 35H35V33C35 32.5417 34.8854 32.125 34.6562 31.75C34.4271 31.375 34.125 31.0833 33.75 30.875C31.5 29.75 29.2292 28.9063 26.9375 28.3438C24.6458 27.7813 22.3333 27.5 20 27.5C17.6667 27.5 15.3542 27.7813 13.0625 28.3438C10.7708 28.9063 8.5 29.75 6.25 30.875C5.875 31.0833 5.57292 31.375 5.34375 31.75C5.11458 32.125 5 32.5417 5 33V35ZM20 15C21.375 15 22.5521 14.5104 23.5312 13.5312C24.5104 12.5521 25 11.375 25 10C25 8.625 24.5104 7.44792 23.5312 6.46875C22.5521 5.48958 21.375 5 20 5C18.625 5 17.4479 5.48958 16.4688 6.46875C15.4896 7.44792 15 8.625 15 10C15 11.375 15.4896 12.5521 16.4688 13.5312C17.4479 14.5104 18.625 15 20 15Z"/></svg>`,
		clients: `<svg width="16" height="16" fill="currentColor" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M0 34.5454V29.4545C0 28.4242 0.265151 27.4773 0.795455 26.6136C1.32576 25.75 2.0303 25.0909 2.90909 24.6363C4.78788 23.697 6.69697 22.9924 8.63636 22.5227C10.5758 22.053 12.5455 21.8182 14.5455 21.8182C16.5455 21.8182 18.5152 22.053 20.4545 22.5227C22.3939 22.9924 24.303 23.697 26.1818 24.6363C27.0606 25.0909 27.7652 25.75 28.2955 26.6136C28.8258 27.4773 29.0909 28.4242 29.0909 29.4545V34.5454H0ZM32.7273 34.5454V29.0909C32.7273 27.7576 32.3561 26.4773 31.6136 25.25C30.8712 24.0227 29.8182 22.9697 28.4545 22.0909C30 22.2727 31.4545 22.5833 32.8182 23.0227C34.1818 23.4621 35.4545 24 36.6364 24.6363C37.7273 25.2424 38.5606 25.9166 39.1364 26.6591C39.7121 27.4015 40 28.2121 40 29.0909V34.5454H32.7273ZM14.5455 20C12.5455 20 10.8333 19.2879 9.40909 17.8636C7.98485 16.4394 7.27273 14.7273 7.27273 12.7273C7.27273 10.7273 7.98485 9.01513 9.40909 7.59089C10.8333 6.16665 12.5455 5.45453 14.5455 5.45453C16.5455 5.45453 18.2576 6.16665 19.6818 7.59089C21.1061 9.01513 21.8182 10.7273 21.8182 12.7273C21.8182 14.7273 21.1061 16.4394 19.6818 17.8636C18.2576 19.2879 16.5455 20 14.5455 20ZM32.7273 12.7273C32.7273 14.7273 32.0152 16.4394 30.5909 17.8636C29.1667 19.2879 27.4545 20 25.4545 20C25.1212 20 24.697 19.9621 24.1818 19.8863C23.6667 19.8106 23.2424 19.7273 22.9091 19.6363C23.7273 18.6666 24.3561 17.5909 24.7955 16.4091C25.2348 15.2273 25.4545 14 25.4545 12.7273C25.4545 11.4545 25.2348 10.2273 24.7955 9.04544C24.3561 7.86362 23.7273 6.78786 22.9091 5.81817C23.3333 5.66665 23.7576 5.56817 24.1818 5.52271C24.6061 5.47726 25.0303 5.45453 25.4545 5.45453C27.4545 5.45453 29.1667 6.16665 30.5909 7.59089C32.0152 9.01513 32.7273 10.7273 32.7273 12.7273ZM3.63636 30.9091H25.4545V29.4545C25.4545 29.1212 25.3712 28.8182 25.2045 28.5454C25.0379 28.2727 24.8182 28.0606 24.5455 27.9091C22.9091 27.0909 21.2576 26.4773 19.5909 26.0682C17.9242 25.6591 16.2424 25.4545 14.5455 25.4545C12.8485 25.4545 11.1667 25.6591 9.5 26.0682C7.83333 26.4773 6.18182 27.0909 4.54545 27.9091C4.27273 28.0606 4.05303 28.2727 3.88636 28.5454C3.7197 28.8182 3.63636 29.1212 3.63636 29.4545V30.9091ZM14.5455 16.3636C15.5455 16.3636 16.4015 16.0076 17.1136 15.2954C17.8258 14.5833 18.1818 13.7273 18.1818 12.7273C18.1818 11.7273 17.8258 10.8712 17.1136 10.1591C16.4015 9.44695 15.5455 9.09089 14.5455 9.09089C13.5455 9.09089 12.6894 9.44695 11.9773 10.1591C11.2652 10.8712 10.9091 11.7273 10.9091 12.7273C10.9091 13.7273 11.2652 14.5833 11.9773 15.2954C12.6894 16.0076 13.5455 16.3636 14.5455 16.3636Z"/></svg>`,
		building: `<svg width="16" height="16" fill="currentColor" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M0.171021 40V8.88889H9.05991V0H31.2821V17.7778H40.171V40H22.3932V31.1111H17.9488V40H0.171021ZM4.61546 35.5556H9.05991V31.1111H4.61546V35.5556ZM4.61546 26.6667H9.05991V22.2222H4.61546V26.6667ZM4.61546 17.7778H9.05991V13.3333H4.61546V17.7778ZM13.5044 26.6667H17.9488V22.2222H13.5044V26.6667ZM13.5044 17.7778H17.9488V13.3333H13.5044V17.7778ZM13.5044 8.88889H17.9488V4.44444H13.5044V8.88889ZM22.3932 26.6667H26.8377V22.2222H22.3932V26.6667ZM22.3932 17.7778H26.8377V13.3333H22.3932V17.7778ZM22.3932 8.88889H26.8377V4.44444H22.3932V8.88889ZM31.2821 35.5556H35.7266V31.1111H31.2821V35.5556ZM31.2821 26.6667H35.7266V22.2222H31.2821V26.6667Z"/></svg>`,
		notes: `<svg width="16" height="16" fill="currentColor" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M10.6975 36.0022V13.9643C10.6975 12.8649 11.0973 11.9321 11.8969 11.1659C12.6964 10.3996 13.6459 10.0165 14.7453 10.0165H36.6832C37.7826 10.0165 38.7238 10.4079 39.5067 11.1908C40.2896 11.9737 40.681 12.9149 40.681 14.0143V30.0055L30.6865 40H14.6953C13.5959 40 12.6548 39.6085 11.8719 38.8256C11.089 38.0427 10.6975 37.1016 10.6975 36.0022ZM0.752991 8.51732C0.553101 7.41792 0.769648 6.4268 1.40263 5.54395C2.03562 4.6611 2.90181 4.11973 4.0012 3.91984L25.6893 0.0719604C26.7887 -0.12793 27.7798 0.0886179 28.6626 0.721603C29.5455 1.35459 30.0869 2.22078 30.2867 3.32017L30.7865 6.01869H26.6887L26.3389 4.01979L4.70082 7.86767L6.69972 19.1615V33.1038C6.16668 32.804 5.7086 32.4042 5.32548 31.9045C4.94235 31.4047 4.70082 30.8384 4.60087 30.2054L0.752991 8.51732ZM14.6953 14.0143V36.0022H28.6876V28.0066H36.6832V14.0143H14.6953Z"/></svg>`,
		alert: `<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
		training: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M23.0283 40.2L20.2 37.3717L27.3717 30.2L10.2 13.0283L3.02829 20.2L0.200012 17.3717L3.02829 14.4424L0.200012 11.6142L4.44244 7.37173L1.61415 4.44244L4.44244 1.61415L7.37173 4.44244L11.6142 0.200012L14.4424 3.02829L17.3717 0.200012L20.2 3.02829L13.0283 10.2L30.2 27.3717L37.3717 20.2L40.2 23.0283L37.3717 25.9576L40.2 28.7859L35.9576 33.0283L38.7859 35.9576L35.9576 38.7859L33.0283 35.9576L28.7859 40.2L25.9576 37.3717L23.0283 40.2Z"/></svg>`,
		dumbbell: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M37.2728 14.7846L34.4711 11.9829L35.972 10.4319L29.5681 4.028L28.0171 5.52891L25.1654 2.67717L26.6663 1.12622C27.4334 0.359085 28.384 -0.0161446 29.5181 0.00053224C30.6521 0.0172091 31.6027 0.409116 32.3698 1.17625L38.8238 7.6302C39.5909 8.39734 39.9745 9.33958 39.9745 10.4569C39.9745 11.5743 39.5909 12.5165 38.8238 13.2837L37.2728 14.7846ZM13.2581 38.8493C12.491 39.6164 11.5487 40 10.4314 40C9.31403 40 8.37179 39.6164 7.60465 38.8493L1.1507 32.3953C0.383568 31.6282 0 30.686 0 29.5686C0 28.4513 0.383568 27.509 1.1507 26.7419L2.65162 25.241L5.50337 28.0927L3.95242 29.5936L10.4064 36.0476L11.9073 34.4966L14.759 37.3484L13.2581 38.8493ZM33.1203 22.039L35.972 19.1873L20.8127 4.028L17.961 6.87974L33.1203 22.039ZM19.1117 36.0476L21.9634 33.1458L6.85419 18.0366L3.95242 20.8883L19.1117 36.0476ZM18.8115 24.3404L24.3149 18.8871L21.1129 15.6851L15.6596 21.1885L18.8115 24.3404ZM21.9634 38.8493C21.1963 39.6164 20.2457 40 19.1117 40C17.9777 40 17.0271 39.6164 16.2599 38.8493L1.1507 23.7401C0.383568 22.9729 0 22.0223 0 20.8883C0 19.7543 0.383568 18.8037 1.1507 18.0366L4.00245 15.1848C4.76958 14.4177 5.71183 14.0341 6.82918 14.0341C7.94653 14.0341 8.88877 14.4177 9.65591 15.1848L12.8078 18.3367L18.3112 12.8334L15.1593 9.73148C14.3921 8.96435 14.0086 8.01377 14.0086 6.87974C14.0086 5.74571 14.3921 4.79513 15.1593 4.028L18.011 1.17625C18.7782 0.409116 19.7204 0.0255475 20.8377 0.0255475C21.9551 0.0255475 22.8973 0.409116 23.6645 1.17625L38.8238 16.3355C39.5909 17.1027 39.9745 18.0449 39.9745 19.1623C39.9745 20.2796 39.5909 21.2218 38.8238 21.989L35.972 24.8407C35.2049 25.6079 34.2543 25.9914 33.1203 25.9914C31.9862 25.9914 31.0357 25.6079 30.2685 24.8407L27.1666 21.6888L21.6633 27.1922L24.8152 30.3441C25.5823 31.1112 25.9659 32.0535 25.9659 33.1708C25.9659 34.2882 25.5823 35.2304 24.8152 35.9976L21.9634 38.8493Z"/></svg>`,
		running: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M23.7209 40V28.8372L19.8139 25.1163L17.9535 33.3023L5.11627 30.6977L5.86046 26.9767L14.7907 28.8372L17.7674 13.7674L14.4186 15.0698V21.3953H10.6977V12.6512L18.0465 9.48837C19.1318 9.02326 19.9302 8.72093 20.4419 8.5814C20.9535 8.44186 21.4263 8.37209 21.8605 8.37209C22.5116 8.37209 23.1163 8.54264 23.6744 8.88372C24.2326 9.22481 24.6822 9.67442 25.0232 10.2326L26.8837 13.2093C27.6899 14.5116 28.7829 15.5814 30.1628 16.4186C31.5426 17.2558 33.1163 17.6744 34.8837 17.6744V21.3953C32.8372 21.3953 30.9225 20.969 29.1395 20.1163C27.3566 19.2636 25.8605 18.1395 24.6512 16.7442L23.5349 22.3256L27.4419 26.0465V40H23.7209ZM24.6512 7.44186C23.6279 7.44186 22.7519 7.07752 22.0233 6.34884C21.2946 5.62016 20.9302 4.74419 20.9302 3.72093C20.9302 2.69767 21.2946 1.82171 22.0233 1.09302C22.7519 0.364341 23.6279 0 24.6512 0C25.6744 0 26.5504 0.364341 27.2791 1.09302C28.0077 1.82171 28.3721 2.69767 28.3721 3.72093C28.3721 4.74419 28.0077 5.62016 27.2791 6.34884C26.5504 7.07752 25.6744 7.44186 24.6512 7.44186Z"/></svg>`,
		trophy: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M8.88889 40V35.5556H17.7778V28.6667C15.963 28.2593 14.3426 27.4907 12.9167 26.3611C11.4907 25.2315 10.4444 23.8148 9.77778 22.1111C7 21.7778 4.67593 20.5648 2.80556 18.4722C0.935185 16.3796 0 13.9259 0 11.1111V8.88889C0 7.66667 0.435185 6.62037 1.30556 5.75C2.17593 4.87963 3.22222 4.44444 4.44444 4.44444H8.88889V0H31.1111V4.44444H35.5556C36.7778 4.44444 37.8241 4.87963 38.6944 5.75C39.5648 6.62037 40 7.66667 40 8.88889V11.1111C40 13.9259 39.0648 16.3796 37.1944 18.4722C35.3241 20.5648 33 21.7778 30.2222 22.1111C29.5556 23.8148 28.5093 25.2315 27.0833 26.3611C25.6574 27.4907 24.037 28.2593 22.2222 28.6667V35.5556H31.1111V40H8.88889ZM8.88889 17.3333V8.88889H4.44444V11.1111C4.44444 12.5185 4.85185 13.787 5.66667 14.9167C6.48148 16.0463 7.55556 16.8519 8.88889 17.3333ZM20 24.4444C21.8519 24.4444 23.4259 23.7963 24.7222 22.5C26.0185 21.2037 26.6667 19.6296 26.6667 17.7778V4.44444H13.3333V17.7778C13.3333 19.6296 13.9815 21.2037 15.2778 22.5C16.5741 23.7963 18.1481 24.4444 20 24.4444ZM31.1111 17.3333C32.4444 16.8519 33.5185 16.0463 34.3333 14.9167C35.1481 13.787 35.5556 12.5185 35.5556 11.1111V8.88889H31.1111V17.3333Z"/></svg>`,
		star: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M12.8285 39.7691L16.1774 25.7923L5.01953 16.4567L19.3519 15.2589L25.1663 2.07617L30.9806 15.2589L45.313 16.4567L34.1551 25.7923L37.504 39.7691L25.1663 32.2179L12.8285 39.7691Z" transform="translate(-5.01953 0)"/></svg>`,
		grad: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M20.0312 22.2778L0.96875 13.3333L20.0312 4.44444L39.0938 13.3333L20.0312 22.2778ZM20.0312 31.1111L6.92708 24.4167L9.41667 23.3333L20.0312 28.5556L30.6458 23.3333L33.1354 24.4167L20.0312 31.1111ZM20.0312 40L6.92708 33.3056V20.6111L20.0312 27.3056L33.1354 20.6111V33.3056L20.0312 40Z"/></svg>`,
		plane: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M7.11111 40V35.5556L11.5556 31.1111V20L0 15.5556V11.1111L11.5556 15.5556V4.44444C11.5556 3.25926 11.9722 2.24074 12.8056 1.38889C13.6389 0.537037 14.6296 0.111111 15.7778 0.111111C16.963 0.111111 17.963 0.537037 18.7778 1.38889C19.5926 2.24074 20 3.25926 20 4.44444V15.5556L31.5556 11.1111V15.5556L20 20V31.1111L24.4444 35.5556V40L15.7778 37.7778L7.11111 40Z"/></svg>`,
		wrench: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M34.1667 40L20 25.8333V20.8333L16.6667 17.5L18.3333 15.8333L22.5 20L18.3333 24.1667L32.5 38.3333L34.1667 40ZM7.5 40C5.41667 40 3.64583 39.2708 2.1875 37.8125C0.729167 36.3542 0 34.5833 0 32.5C0 31.4167 0.208333 30.3958 0.625 29.4375C1.04167 28.4792 1.58333 27.6667 2.25 27L10.8333 18.3333L15 22.5L8.33333 29.1667C8.08333 29.4167 7.91667 29.7083 7.83333 30.0417C7.75 30.375 7.75 30.7083 7.83333 31.0417C7.91667 31.375 8.08333 31.6667 8.33333 31.9167C8.58333 32.1667 8.875 32.3333 9.20833 32.4167C9.54167 32.5 9.875 32.5 10.2083 32.4167C10.5417 32.3333 10.8333 32.1667 11.0833 31.9167L17.75 25.25L19.4167 26.9167L10.75 35.5833C10.0833 36.25 9.27083 36.8021 8.3125 37.2396C7.35417 37.6771 6.41667 37.8958 5.5 37.8958H5.33333C4.08333 37.8958 2.98958 37.4688 2.05208 36.6146C1.11458 35.7604 0.541667 34.7083 0.333333 33.4583C0.291667 33.2083 0.270833 32.9583 0.270833 32.7083C0.270833 32.4583 0.291667 32.2083 0.333333 31.9583C0.625 30.625 1.33333 29.5 2.45833 28.5833C3.58333 27.6667 4.875 27.2083 6.33333 27.2083C6.875 27.2083 7.41667 27.2917 7.95833 27.4583C8.5 27.625 9 27.8333 9.45833 28.0833L16.6667 20.8333L14.1667 18.3333L18.3333 14.1667L13.3333 9.16667L16.6667 5.83333C15.9167 5.41667 15.2083 5.10417 14.5417 4.89583C13.875 4.6875 13.1667 4.58333 12.4167 4.58333C10.4583 4.58333 8.77083 5.25 7.35417 6.58333C5.9375 7.91667 5.125 9.54167 4.91667 11.4583L0.666667 9.08333C1.04167 6.66667 2.16667 4.60417 4.04167 2.89583C5.91667 1.1875 8.08333 0.333333 10.5417 0.333333C12.3333 0.333333 14 0.791667 15.5417 1.70833C17.0833 2.625 18.3333 3.875 19.2917 5.45833L21.9583 8.125L33.3333 0L40 6.66667L31.875 18.0417L34.5417 20.7083C36.125 21.6667 37.375 22.9167 38.2917 24.4583C39.2083 26 39.6667 27.6667 39.6667 29.4583C39.6667 31.9167 38.8125 34.0833 37.1042 35.9583C35.3958 37.8333 33.3333 38.9583 30.9167 39.3333L28.5417 35.0833C30.4583 34.875 32.0833 34.0625 33.4167 32.6458C34.75 31.2292 35.4167 29.5417 35.4167 27.5833C35.4167 26.8333 35.3125 26.125 35.1042 25.4583C34.8958 24.7917 34.5833 24.0833 34.1667 23.3333L31.6667 25.8333L26.6667 20.8333L29.1667 18.3333L14.9167 4.08333L12.4167 6.58333L18.3333 12.5L10.8333 20L22.5 31.6667L34.1667 40Z"/></svg>`,
		gymnastics: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M20.681 33.3636L19.7719 15.1818L13.4083 13.3636H0.68103V9.72726H11.5901L24.3174 0.636353L26.681 3.40908L19.1356 8.81817H24.3174L38.4992 0.636353L40.681 3.18181L25.2265 15.1818L24.3174 33.3636H20.681ZM9.77194 7.90908C8.77194 7.90908 7.91588 7.55302 7.20376 6.8409C6.49164 6.12878 6.13558 5.27272 6.13558 4.27272C6.13558 3.27272 6.49164 2.41666 7.20376 1.70453C7.91588 0.992413 8.77194 0.636353 9.77194 0.636353C10.7719 0.636353 11.628 0.992413 12.3401 1.70453C13.0522 2.41666 13.4083 3.27272 13.4083 4.27272C13.4083 5.27272 13.0522 6.12878 12.3401 6.8409C11.628 7.55302 10.7719 7.90908 9.77194 7.90908Z"/></svg>`,
		mobility: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M2.30121 35.9957V27.9967C2.30121 25.2303 3.27609 22.8723 5.22586 20.9225C7.17563 18.9727 9.53368 17.9979 12.3 17.9979H33.7475C35.014 17.9979 36.0889 18.4311 36.9721 19.2977C37.8553 20.1643 38.2969 21.2308 38.2969 22.4973C38.2969 23.5305 37.9803 24.4554 37.347 25.272C36.7138 26.0886 35.9139 26.6302 34.9473 26.8968L30.2979 28.2466V35.9957C30.2979 36.6956 30.1396 37.3289 29.8229 37.8955C29.5063 38.4621 29.0814 38.9287 28.5481 39.2953C28.0148 39.6619 27.4316 39.8869 26.7983 39.9702C26.165 40.0536 25.5151 39.9619 24.8485 39.6953L15.3996 35.9957H2.30121ZM26.2984 29.9964H15.0497C14.8164 29.9964 14.6414 30.0631 14.5248 30.1964C14.4081 30.3297 14.3331 30.4797 14.2998 30.6464C14.2665 30.813 14.2914 30.9713 14.3748 31.1213C14.4581 31.2713 14.5997 31.3796 14.7997 31.4463L26.2984 35.9957V29.9964ZM6.30073 31.9962H10.5002C10.4336 31.7962 10.3836 31.5962 10.3503 31.3963C10.3169 31.1963 10.3003 30.9796 10.3003 30.7463C10.3003 29.4465 10.7669 28.33 11.7001 27.3967C12.6333 26.4635 13.7498 25.9969 15.0497 25.9969H23.1987L33.8974 23.0473C34.0641 22.9806 34.1807 22.8973 34.2474 22.7973C34.3141 22.6973 34.3307 22.5806 34.2974 22.4473C34.2641 22.314 34.2057 22.2057 34.1224 22.1224C34.0391 22.039 33.9141 21.9974 33.7475 21.9974H12.3C10.6336 21.9974 9.21705 22.5806 8.05052 23.7472C6.884 24.9137 6.30073 26.3302 6.30073 27.9967V31.9962ZM16.2995 15.9981C14.0998 15.9981 12.2167 15.2149 10.6502 13.6484C9.08373 12.0819 8.30049 10.1988 8.30049 7.99905C8.30049 5.79931 9.08373 3.9162 10.6502 2.34972C12.2167 0.78324 14.0998 0 16.2995 0C18.4993 0 20.3824 0.78324 21.9489 2.34972C23.5154 3.9162 24.2986 5.79931 24.2986 7.99905C24.2986 10.1988 23.5154 12.0819 21.9489 13.6484C20.3824 15.2149 18.4993 15.9981 16.2995 15.9981ZM16.2995 11.9986C17.3994 11.9986 18.341 11.607 19.1242 10.8237C19.9074 10.0405 20.2991 9.09892 20.2991 7.99905C20.2991 6.89918 19.9074 5.95762 19.1242 5.17438C18.341 4.39114 17.3994 3.99952 16.2995 3.99952C15.1997 3.99952 14.2581 4.39114 13.4749 5.17438C12.6916 5.95762 12.3 6.89918 12.3 7.99905C12.3 9.09892 12.6916 10.0405 13.4749 10.8237C14.2581 11.607 15.1997 11.9986 16.2995 11.9986Z"/></svg>`
	};

	function getBookingIconSvg(booking: FullBooking): string {
		if (booking.booking.tryOut) return svgIcon.star;
		if (booking.booking.internalEducation) return svgIcon.wrench;
		if (booking.additionalInfo?.education) return svgIcon.grad;
		if (booking.additionalInfo?.internal) return svgIcon.plane;

		const contentIcon = resolveBookingContentIcon({
			icon: booking.additionalInfo?.bookingContent?.icon,
			kind: booking.additionalInfo?.bookingContent?.kind
		});
		if (contentIcon === 'Dumbbell') return svgIcon.dumbbell;
		if (contentIcon === 'Gymnastics') return svgIcon.gymnastics;
		if (contentIcon === 'Mobility') return svgIcon.mobility;
		if (contentIcon === 'Running') return svgIcon.running;
		if (contentIcon === 'Trophy') return svgIcon.trophy;
		if (contentIcon === 'GraduationCap') return svgIcon.grad;
		if (contentIcon === 'ShiningStar') return svgIcon.star;

		return svgIcon.training;
	}

	function getBookingTypeName(booking: FullBooking): string {
		if (booking.booking.tryOut) return 'Provpass';
		if (booking.booking.internalEducation) return 'Intern utbildning';
		if (booking.additionalInfo?.education) return 'Utbildning';
		if (booking.additionalInfo?.internal) return 'Intern';
		if (booking.additionalInfo?.bookingContent?.kind) {
			return escapeHtml(booking.additionalInfo.bookingContent.kind);
		}
		return 'Träning';
	}

	function generatePersonalBookingContent(booking: FullBooking): string {
		const name = escapeHtml(booking.personalBooking?.name) || 'Personlig bokning';
		const text = escapeHtml(booking.personalBooking?.text);
		const kind = escapeHtml(booking.personalBooking?.kind);
		const startTime = booking.booking.startTime;
		const endTime =
			booking.booking.endTime ??
			new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();

		const dateStr = formatDateTime(startTime);
		const timeStr = `${formatTime(startTime)} - ${formatTime(endTime)}`;

		let sections = `
			<div class="px-4 py-3 border-b border-gray-200">
				<h3 class="font-semibold text-base text-gray-900">${name}</h3>
				<p class="text-xs text-gray-500 mt-1">${dateStr}</p>
			</div>
			<div class="px-4 py-3">
				<div class="flex items-center gap-2 mb-2">
					${svgIcon.clock}
					<span class="text-sm font-medium text-gray-700">${timeStr}</span>
				</div>
		`;

		if (kind) {
			sections += `
				<div class="flex items-center gap-2 mb-2">
					${svgIcon.star}
					<span class="text-sm text-gray-600">${kind}</span>
				</div>
			`;
		}

		if (text) {
			sections += `
				<div class="mt-2 pt-2 border-t border-gray-100">
					<p class="text-sm text-gray-600">${text}</p>
				</div>
			`;
		}

		sections += '</div>';
		return sections;
	}

	function generateRegularBookingContent(booking: FullBooking): string {
		const startTime = booking.booking.startTime;
		const endTime =
			booking.booking.endTime ??
			new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();

		const dateStr = formatDateTime(startTime);
		const timeStr = `${formatTime(startTime)} - ${formatTime(endTime)}`;

		const bookingType = getBookingTypeName(booking);
		const bookingIcon = getBookingIconSvg(booking);

		const trainerName = booking.trainer
			? `${escapeHtml(booking.trainer.firstname)} ${escapeHtml(booking.trainer.lastname)}`
			: 'Tränare saknas';

		let participantLabel = 'Klient';
		let participantName = 'Klient saknas';
		let participantIsInactive = false;

		if (booking.booking.internalEducation || booking.additionalInfo?.education) {
			participantLabel = 'Trainee';
			if (booking.trainee) {
				participantName = `${escapeHtml(booking.trainee.firstname)} ${escapeHtml(booking.trainee.lastname)}`;
				participantIsInactive = booking.trainee.active === false;
			} else {
				participantName = 'Trainee saknas';
			}
		} else if (booking.client) {
			participantName = `${escapeHtml(booking.client.firstname)} ${escapeHtml(booking.client.lastname)}`;
			participantIsInactive = booking.client.active === false;
		}
		const participantInactiveLabel = participantIsInactive
			? ' <span class="text-error">(Ej aktiv)</span>'
			: '';

		const locationName = escapeHtml(booking.location?.name) || 'Ingen plats';
		const locationColor = booking.location?.color || '#000000';

		const status = escapeHtml(booking.booking.status) || 'New';
		const isCancelled = status === 'Cancelled' || status === 'Late_cancelled';

		let sections = `
			<div class="px-4 py-3 border-b border-gray-200" style="border-left: 4px solid ${locationColor}">
				<div class="flex items-center gap-2 mb-1">
					${bookingIcon}
					<h3 class="font-semibold text-base text-gray-900">${bookingType}</h3>
				</div>
				<p class="text-xs text-gray-500">${dateStr}</p>
			</div>
			<div class="px-4 py-3 space-y-2">
				<div class="flex items-center gap-2">
					${svgIcon.clock}
					<span class="text-sm font-medium text-gray-700">${timeStr}</span>
				</div>

				<div class="flex items-start gap-2">
					${svgIcon.person}
					<div class="text-sm">
						<p class="font-medium text-gray-700">${trainerName}</p>
					</div>
				</div>

				<div class="flex items-start gap-2">
				${svgIcon.clients}
				<div class="text-sm">
					<p class="font-medium text-gray-700">${participantName}${participantInactiveLabel}</p>
				</div>
				</div>

				<div class="flex items-center gap-2">
					${svgIcon.building}
					<div class="text-sm">
						<p class="font-medium text-gray-700">${locationName}</p>
					</div>
				</div>
		`;

		if (isCancelled) {
			sections += `
				<div class="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
					${svgIcon.alert}
					<span class="text-sm font-semibold text-red-600">Avbokad</span>
				</div>
			`;
		}

		if (booking.linkedNoteCount && booking.linkedNoteCount > 0) {
			sections += `
				<div class="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
					${svgIcon.notes}
					<span class="text-sm text-gray-600">${booking.linkedNoteCount} ${booking.linkedNoteCount === 1 ? 'anteckning' : 'anteckningar'}</span>
				</div>
			`;
		}

		sections += '</div>';
		return sections;
	}

	// Position Tooltip (with clamping)
	function positionTooltip() {
		if (!tooltipEl || destroyed || !node.isConnected) return;

		const margin = 8;
		const anchorRect = node.getBoundingClientRect();
		const tooltipRect = tooltipEl.getBoundingClientRect();
		const finalPos = getBestPosition(anchorRect, tooltipRect, preferred ?? 'bottom', margin);

		let top = 0;
		let left = 0;
		switch (finalPos) {
			case 'bottom':
				top = anchorRect.bottom + margin;
				left = anchorRect.left + (anchorRect.width - tooltipRect.width) / 2;
				break;
			case 'top':
				top = anchorRect.top - tooltipRect.height - margin;
				left = anchorRect.left + (anchorRect.width - tooltipRect.width) / 2;
				break;
			case 'right':
				top = anchorRect.top + (anchorRect.height - tooltipRect.height) / 2;
				left = anchorRect.right + margin;
				break;
			case 'left':
				top = anchorRect.top + (anchorRect.height - tooltipRect.height) / 2;
				left = anchorRect.left - tooltipRect.width - margin;
				break;
		}

		// Clamp so the tooltip doesn't overflow the viewport
		if (left < margin) {
			left = margin;
		} else if (left + tooltipRect.width > window.innerWidth - margin) {
			left = window.innerWidth - margin - tooltipRect.width;
		}

		if (top < margin) {
			top = margin;
		} else if (top + tooltipRect.height > window.innerHeight - margin) {
			top = window.innerHeight - margin - tooltipRect.height;
		}

		tooltipEl.style.top = `${top}px`;
		tooltipEl.style.left = `${left}px`;
	}

	// Determines Best Position
	function getBestPosition(
		anchorRect: DOMRect,
		tooltipRect: DOMRect,
		pref: string,
		margin: number
	): 'bottom' | 'top' | 'right' | 'left' {
		const fallbackOrder = [...new Set([pref, 'bottom', 'top', 'right', 'left'])];
		for (const pos of fallbackOrder) {
			if (canPlace(pos, anchorRect, tooltipRect, margin)) {
				return pos as 'bottom' | 'top' | 'right' | 'left';
			}
		}
		return 'bottom';
	}

	function canPlace(position: string, anchorRect: DOMRect, tipRect: DOMRect, margin: number) {
		switch (position) {
			case 'bottom':
				return anchorRect.bottom + tipRect.height + margin <= window.innerHeight;
			case 'top':
				return anchorRect.top - tipRect.height - margin >= 0;
			case 'right':
				return anchorRect.right + tipRect.width + margin <= window.innerWidth;
			case 'left':
				return anchorRect.left - tipRect.width - margin >= 0;
		}
		return false;
	}

	function applyParams(newParams?: BookingTooltipParams | null) {
		if (destroyed) return;
		booking = newParams?.booking ?? null;
		preferred = newParams?.preferred ?? 'bottom';
		delay = newParams?.delay ?? 300;
		enabled = Boolean(booking);

		if (!enabled) {
			hide();
		}
	}

	applyParams(params);

	// Attach Events
	node.addEventListener('mouseenter', onMouseEnter);
	node.addEventListener('mouseleave', onMouseLeave);

	function update(newParams?: BookingTooltipParams | null) {
		applyParams(newParams);
	}

	function destroy() {
		destroyed = true;
		enabled = false;
		visible = false;
		booking = null;
		if (showTimer) {
			clearTimeout(showTimer);
			showTimer = null;
		}
		node.removeEventListener('mouseenter', onMouseEnter);
		node.removeEventListener('mouseleave', onMouseLeave);
		removeTooltip();
	}

	return { update, destroy };
}
