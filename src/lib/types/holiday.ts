export type Holiday = {
        id: number;
        name: string;
        date: string;
        description: string | null;
        createdAt: string;
        updatedAt: string;
};

export type HolidayPayload = {
        name: string;
        date: string;
        description?: string | null;
};

export type HolidayRange = {
        from: string;
        to: string;
};
