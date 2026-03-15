export type SalaryReportDetail = {
	id: number;
	startTime: string;
	endTime: string | null;
	durationMinutes: number;
	obMinutes?: number;
	clientName: string | null;
	customerName: string | null;
	bookingType: string | null;
	locationName: string | null;
};

export type SalaryReportExtraDuty = {
	id: number;
	name: string;
	approved: boolean;
	note: string | null;
};

export type SalaryReportAbsenceDetail = {
	id: string;
	kindKey: string;
	kindLabel: string;
	startDate: string;
	endDate: string;
	days: number;
	description: string | null;
	source: 'absence' | 'vacation';
	status: string | null;
	approved: boolean;
};

export type SalaryReportAbsenceGroup = {
	key: string;
	label: string;
	approved: boolean;
	approvalLabel: 'Godkänd' | 'Ej godkänd';
	days: number;
	count: number;
	entries: SalaryReportAbsenceDetail[];
};

export type SalaryReportTrainer = {
	id: number;
	name: string;
	email: string | null;
	locationId: number | null;
	locationName: string | null;
	weekdayHours: number;
	obHours: number;
	weekendHours: number;
	holidayHours: number;
	educationHours: number;
	tryOutHours: number;
	internalHours: number;
	totalHours: number;
	sessionCount: number;
	approvedExtra: number;
	pendingExtra: number;
	absenceDays: number;
	absenceCount: number;
	unapprovedAbsenceDays: number;
	unapprovedAbsenceCount: number;
	weekday: SalaryReportDetail[];
	ob: SalaryReportDetail[];
	weekend: SalaryReportDetail[];
	holiday: SalaryReportDetail[];
	education: SalaryReportDetail[];
	tryOut: SalaryReportDetail[];
	internal: SalaryReportDetail[];
	extraDuties: SalaryReportExtraDuty[];
	absences: SalaryReportAbsenceGroup[];
};

export type SalaryReportResponse = {
	month: number;
	year: number;
	generatedAt: string;
	range: { start: string; end: string };
	isMonthComplete: boolean;
	trainers: SalaryReportTrainer[];
};
