const STOCKHOLM_TZ = 'Europe/Stockholm';

const stockholmTimeFormatter = new Intl.DateTimeFormat('en-GB', {
	timeZone: STOCKHOLM_TZ,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: false
});

type DateLike = string | Date | null | undefined;

export type TimeParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
};

function toDate(value: DateLike): Date | null {
	if (!value) return null;
	if (value instanceof Date) return value;
	if (typeof value === 'string') {
		const isoLike = value.includes('T') ? value : value.replace(' ', 'T');

		const direct = new Date(isoLike);
		if (!Number.isNaN(direct.getTime())) return direct;

		const withZ = isoLike.endsWith('Z') ? isoLike : `${isoLike}Z`;
		const zParsed = new Date(withZ);
		if (!Number.isNaN(zParsed.getTime())) return zParsed;
	}
	return null;
}

export function extractStockholmTimeParts(value: DateLike): TimeParts | null {
	const date = toDate(value);
	if (!date) return null;

	const parts = stockholmTimeFormatter.formatToParts(date);

	let year: string | undefined;
	let month: string | undefined;
	let day: string | undefined;
	let hour: string | undefined;
	let minute: string | undefined;
	let second: string | undefined;

	for (const part of parts) {
		switch (part.type) {
			case 'year':
				year = part.value;
				break;
			case 'month':
				month = part.value;
				break;
			case 'day':
				day = part.value;
				break;
			case 'hour':
				hour = part.value;
				break;
			case 'minute':
				minute = part.value;
				break;
			case 'second':
				second = part.value;
				break;
		}
	}

	if (
		year === undefined ||
		month === undefined ||
		day === undefined ||
		hour === undefined ||
		minute === undefined
	) {
		return null;
	}

	return {
		year: Number(year),
		month: Number(month),
		day: Number(day),
		hour: Number(hour),
		minute: Number(minute),
		second: Number(second ?? '0')
	};
}

export function extractStockholmMinutes(value: DateLike): number | null {
	const time = extractStockholmTimeParts(value);
	if (!time) return null;
	return time.hour * 60 + time.minute;
}
