-- Validade calculada pela validade típica do tipo (ex.: dedetização = 6 meses),
-- quando o documento não traz a data escrita.
alter table public.property_documents add column if not exists expires_estimated boolean not null default false;
