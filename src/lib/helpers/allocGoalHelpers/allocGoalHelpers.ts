// Always days-per-month + precise rounding so sums match exactly.

export function daysInMonth(year: number, m1to12: number) {
	return new Date(year, m1to12, 0).getDate();
}

function formatDateLocal(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function largestRemainderInt(
	totals: number[],
	fracs: number[],
	neededDelta: number,
	allowedMask?: boolean[]
) {
	const order = fracs
		.map((f, i) => ({ i, f }))
		.sort((a, b) => b.f - a.f)
		.map((x) => x.i)
		.filter((i) => (allowedMask ? allowedMask[i] : true));

	let k = 0;
	while (neededDelta > 0 && k < order.length) {
		totals[order[k]] += 1;
		neededDelta -= 1;
		k += 1;
	}
	return totals;
}

/** Year → Months (days-based). Month anchors are fixed. If anchors > year, we raise year. */
export function splitYearToMonths({
	year,
	yearGoal,
	monthAnchors
}: {
	year: number;
	yearGoal: number | null;
	monthAnchors: { month: number; value: number }[];
}) {
	const months = Array.from({ length: 12 }, (_, i) => ({
		month: i + 1,
		value: 0,
		isAnchor: false
	}));

	const anchors = new Map<number, number>();
	for (const a of monthAnchors) {
		if (a.month >= 1 && a.month <= 12) anchors.set(a.month, Number(a.value) || 0);
	}

	const sumAnch = [...anchors.values()].reduce((s, v) => s + v, 0);
	const finalYear = yearGoal == null ? sumAnch : Math.max(yearGoal, sumAnch);

	const weights: number[] = [];
	const isAnchorArr: boolean[] = [];
	let freeWeight = 0;

	for (let m = 1; m <= 12; m++) {
		const anch = anchors.get(m);
		const isAnch = anch !== undefined;
		isAnchorArr.push(isAnch);
		if (isAnch) {
			months[m - 1].value = anch!;
			months[m - 1].isAnchor = true;
			weights.push(0);
		} else {
			const w = daysInMonth(year, m);
			weights.push(w);
			freeWeight += w;
		}
	}

	const remainder = finalYear - sumAnch;

	if (remainder > 0 && freeWeight > 0) {
		const shares = weights.map((w) => (w > 0 ? (remainder * w) / freeWeight : 0));
		const floors = shares.map((s) => Math.floor(s));
		const fracs = shares.map((s, i) => s - floors[i]);

		// apply floors to free months
		months.forEach((m, i) => {
			if (!isAnchorArr[i]) m.value = floors[i];
		});

		const allocated = months.reduce((s, x) => s + x.value, 0);
		const delta = finalYear - allocated;
		if (delta > 0) {
			const allowedMask = isAnchorArr.map((x) => !x);
			const adjusted = largestRemainderInt(
				months.map((x) => x.value),
				fracs,
				delta,
				allowedMask
			);
			adjusted.forEach((v, i) => (months[i].value = v));
		}
	} else {
		months.forEach((m) => (m.value = Math.round(m.value)));
	}

	return { yearTotal: months.reduce((s, x) => s + x.value, 0), months };
}

/** Month → Weeks (days-based), week anchors fixed, remainder by days. */
export function splitMonthToWeeks({
	year,
	month,
	monthTotal,
	weekAnchors
}: {
	year: number;
	month: number;
	monthTotal: number;
	weekAnchors: { start: string; end: string; value: number }[];
}) {
	const start = new Date(year, month - 1, 1);
	const end = new Date(year, month, 0);

	const seed = new Date(start);
	const mondayOffset = (seed.getDay() + 6) % 7;
	seed.setDate(seed.getDate() - mondayOffset);

	const frames: { start: Date; end: Date; days: number }[] = [];
	while (seed <= end) {
		const ws = new Date(Math.max(seed.getTime(), start.getTime()));
		const we = new Date(seed);
		we.setDate(we.getDate() + 6);
		const weClamped = new Date(Math.min(we.getTime(), end.getTime()));
		const days = Math.floor((weClamped.getTime() - ws.getTime()) / 86400000) + 1;
		frames.push({ start: ws, end: weClamped, days });
		seed.setDate(seed.getDate() + 7);
	}

	const anchorMap = new Map<string, number>();
	for (const a of weekAnchors) {
		anchorMap.set(
			`${a.start}|${a.end}`,
			(anchorMap.get(`${a.start}|${a.end}`) ?? 0) + Number(a.value || 0)
		);
	}

	const weeks = frames.map((f) => {
		const key = `${formatDateLocal(f.start)}|${formatDateLocal(f.end)}`;
		const anch = anchorMap.get(key) ?? 0;
		return { key, start: f.start, end: f.end, days: f.days, anch };
	});

	const sumAnch = weeks.reduce((s, w) => s + w.anch, 0);
	const remainder = Math.max(0, Math.round(monthTotal) - sumAnch);

	const freeWeeks = weeks.filter((w) => w.anch === 0);
	const freeDays = freeWeeks.reduce((s, w) => s + w.days, 0);

	let floors: number[] = weeks.map((w) => w.anch);
	let fracs: number[] = weeks.map((_) => 0);

	if (remainder > 0 && freeDays > 0) {
		const shares = weeks.map((w) => (w.anch > 0 ? w.anch : (remainder * w.days) / freeDays));
		floors = shares.map((s) => Math.floor(s));
		fracs = shares.map((s, i) => s - floors[i]);
	}

	const allocated = floors.reduce((s, v) => s + v, 0);
	const delta = Math.round(monthTotal) - allocated;
	let values = floors.slice();

	if (delta > 0) {
		const allowed = weeks.map((w) => w.anch === 0);
		values = largestRemainderInt(values, fracs, delta, allowed);
	}

	return {
		weeks: weeks.map((w, i) => ({
			week_start: formatDateLocal(w.start),
			week_end: formatDateLocal(w.end),
			value: values[i],
			isAnchor: w.anch > 0
		}))
	};
}
