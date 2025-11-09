export type MailHistoryRecipient = {
        name?: string | null;
        email: string;
};

export type MailHistoryBase = {
        id: number;
        sender_user_id: number | null;
        sender_name: string | null;
        sender_email: string | null;
        recipients: MailHistoryRecipient[];
        recipients_count: number;
        subject: string;
        header: string | null;
        subheader: string | null;
        sent_from: { name?: string | null; email: string } | null;
        sent_at: string;
        status: string | null;
        error: string | null;
};

export type MailHistoryListItem = MailHistoryBase & {
        body_text_preview: string | null;
};

export type MailHistoryItem = MailHistoryBase & {
        body_html: string | null;
        body_text: string | null;
};

export type MailHistoryListResponse = {
        data: MailHistoryListItem[];
        pagination: {
                total: number;
                limit: number;
                offset: number;
                hasMore: boolean;
        };
};

export type MailHistoryQueryParams = {
        limit?: number;
        offset?: number;
        search?: string;
        startDate?: string;
        endDate?: string;
        senderId?: number;
        mineOnly?: boolean;
};
