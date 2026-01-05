export type NewsItem = {
	id: number;
	title: string;
	text: string;
	writer_id: number | null;
	writer_name: string | null;
	published_at: string | null;
	roles: string[];
	created_at: string;
	updated_at: string;
};
