export function getTopOffset(time: string, startHour: number, hourHeight: number): number {
	const date = new Date(time);
	const hours = date.getHours() - startHour;
	const minutes = date.getMinutes();
	return hours * hourHeight + (minutes / 60) * hourHeight;
}

export function getMeetingHeight(startTime: string, endTime: string, hourHeight: number): number {
	const start = new Date(startTime);
	const end = new Date(endTime);
	const diff = (end.getTime() - start.getTime()) / 60000; // minutes
	return (diff / 60) * hourHeight;
}

export function getCurrentTimeOffset(startHour: number, hourHeight: number): number {
	const now = new Date();
	const hours = now.getHours() - startHour;
	const minutes = now.getMinutes();
	return hours * hourHeight + ((minutes / 60) * hourHeight) / 2;
}

export function formatTime(isoString: string): string {
	const date = new Date(isoString);
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function getStartOfWeek(date: Date) {
	const start = new Date(date);
	const day = start.getDay();
	const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when Sunday (0) is the first day of the week
	start.setDate(diff);
	return start;
}
