export type Client = {
	id: number;
	firstname: string;
	lastname: string;
	email: string | null;
	alternative_email?: string | null;
	phone: string | null;
	person_number?: string | null;
	primary_trainer_id?: number | null;
	trainer_id?: number | null;
	trainer_firstname?: string | null;
	trainer_lastname?: string | null;
	primary_location_id?: number | null;
	primary_location?: string | null;
	active: boolean;
	created_at?: string | null;
	updated_at?: string | null;
};
