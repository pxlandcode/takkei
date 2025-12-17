-- Adds a primary location reference for clients (similar to users.default_location_id).
-- Run manually in the database environment; this file is intentionally not executed automatically.

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS primary_location_id integer;

ALTER TABLE public.clients
ADD CONSTRAINT clients_primary_location_fk
FOREIGN KEY (primary_location_id) REFERENCES public.locations(id);

CREATE INDEX IF NOT EXISTS index_clients_on_primary_location_id
ON public.clients(primary_location_id);
