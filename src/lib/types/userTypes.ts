export type Role = {
        id: number;
        user_id: number;
        name: string;
        created_at: string;
        updated_at: string;
};

export type TrainerUser = {
        kind: 'trainer';
        id: number;
        firstname: string;
        lastname: string;
        email: string;
        mobile: string | null;
        default_location_id: number | null;
        active: boolean;
        role: string | null;
        comment: string | null;
        created_at: string;
        updated_at: string;
        initials: string;
        key: string;
        roles: Role[];
        account_id: string;
};

export type ClientUser = {
        kind: 'client';
        id: number;
        firstname: string;
        lastname: string;
        email: string;
        mobile: string | null;
        created_at: string;
        updated_at: string;
        roles: Role[];
        account_id: string;
        default_location_id?: null;
        active?: boolean;
        role?: null;
        comment?: null;
        initials?: string | null;
        key?: string | null;
};

export type User = TrainerUser | ClientUser;
