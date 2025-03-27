export type TableItem = {
	label: string;
	value:
		| string
		| Array<{ type: string; content?: string; label?: string; action?: () => void; icon?: string }>;
};

export type TableType = TableItem[];
