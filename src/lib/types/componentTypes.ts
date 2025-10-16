export type TableCellAction = () => void;

export type TableCellArrayItem = {
	type?: string;
	label?: string | number | boolean | null;
	content?: string | number | boolean | null;
	value?: string | number | boolean | null;
	icon?: string;
	variant?: string;
	action?: TableCellAction;
	[key: string]: unknown;
};

export type TableCellObject = {
	label?: string | number | boolean | null;
	content?: string | number | boolean | null;
	value?: string | number | boolean | null;
	[key: string]: unknown;
};

export type TableCellValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| TableCellArrayItem[]
	| TableCellObject;

export type TableRow = Record<string, TableCellValue>;

export type TableType = TableRow[];
