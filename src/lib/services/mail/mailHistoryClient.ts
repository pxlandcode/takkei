import type {
        MailHistoryItem,
        MailHistoryListResponse,
        MailHistoryQueryParams
} from '$lib/types/mailTypes';

function buildQuery(params: MailHistoryQueryParams): string {
        const searchParams = new URLSearchParams();
        if (typeof params.limit === 'number') searchParams.set('limit', params.limit.toString());
        if (typeof params.offset === 'number') searchParams.set('offset', params.offset.toString());
        if (params.search) searchParams.set('search', params.search);
        if (params.startDate) searchParams.set('startDate', params.startDate);
        if (params.endDate) searchParams.set('endDate', params.endDate);
        if (typeof params.senderId === 'number') searchParams.set('senderId', params.senderId.toString());
        if (typeof params.mineOnly === 'boolean') searchParams.set('mineOnly', params.mineOnly ? 'true' : 'false');
        const queryString = searchParams.toString();
        return queryString ? `?${queryString}` : '';
}

async function handleResponse<T>(response: Response): Promise<T> {
        if (!response.ok) {
                const message = (await response.text()) || 'Request failed';
                throw new Error(message);
        }
        return response.json() as Promise<T>;
}

export async function fetchMailHistory(params: MailHistoryQueryParams = {}): Promise<MailHistoryListResponse> {
        const query = buildQuery(params);
        const res = await fetch(`/api/mail-history${query}`);
        return handleResponse<MailHistoryListResponse>(res);
}

export async function fetchMailHistoryItem(id: number): Promise<MailHistoryItem> {
        const res = await fetch(`/api/mail-history/${id}`);
        return handleResponse<MailHistoryItem>(res);
}
