export type NewsItem = {
	id: number;
	title: string;
	text: string;
	snippet: string;
	writer_id: number | null;
	writer_name: string | null;
	published_at: string | null;
	roles: string[];
	pinned: boolean;
	read_at: string | null;
	like_count: number;
	has_reacted: boolean;
	comment_count: number;
	created_at: string;
	updated_at: string;
};

export type NewsComment = {
	id: number;
	news_item_id: number;
	user_id: number;
	user_name: string | null;
	body: string;
	created_at: string;
	updated_at: string;
	can_edit: boolean;
	can_delete: boolean;
};

export type NewsFilter = 'all' | 'unread' | 'pinned';
