-- Pasta do documento dentro do imóvel (ex.: "Benfeitorias 21 a 27/11/2026").
-- Texto livre: documentos com a mesma pasta aparecem juntos na aba Documentos.
alter table public.property_documents add column if not exists folder text;

create index if not exists property_documents_folder_idx
  on public.property_documents (property_id, folder)
  where folder is not null;
