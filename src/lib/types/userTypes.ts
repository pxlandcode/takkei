export type Role = {
	id: number;
	user_id: number;
	name: string;
	created_at: string;
	updated_at: string;
};

export type User = {
        id: number;
        firstname: string;
        lastname: string;
        email: string;
	mobile: string;
	default_location_id: number | null;
	default_location?: string | null;
	active: boolean;
	salt: string;
	crypted_password: string;
	remember_token: string | null;
	remember_token_expires_at: string | null;
	last_login: string | null;
	role: string | null;
	comment: string | null;
        created_at: string;
        updated_at: string;
        initials: string;
        key: string;
        roles: Role[];
        kind: 'trainer';
        lucia_user_id: string;
};

export type ClientUser = {
        id: number;
        firstname: string;
        lastname: string;
        email: string;
        phone: string | null;
        kind: 'client';
        lucia_user_id: string;
};

export type AuthenticatedUser = User | ClientUser;
