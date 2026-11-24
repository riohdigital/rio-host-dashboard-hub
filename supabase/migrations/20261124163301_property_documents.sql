-- Documentos dos imóveis (dedetização, contratos, seguros, vistorias...).
--
-- O arquivo fica no espaço privado `property-documents`, numa pasta com o id do
-- imóvel: <property_id>/<id do documento>.<extensão>. Ele só abre por link
-- temporário. A IA (Edge Function `ler-documento`) lê o arquivo e preenche
-- título, tipo, datas, fornecedor, valor, resumo e texto para a busca.
--
-- Quem vê e quem edita segue as regras dos imóveis: master vê tudo; os demais
-- veem os imóveis a que têm acesso. Faxineira não vê documentos.

-- 1. Permissões em funções, para valer igual na tabela e nos arquivos ---------

create or replace function public.pode_ver_documentos_do_imovel(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_profiles up
    where up.user_id = auth.uid() and up.role = 'master'
  )
  or (
    not exists (
      select 1 from user_profiles up
      where up.user_id = auth.uid() and up.role = 'faxineira'
    )
    and (
      exists (
        select 1 from user_permissions perm
        where perm.user_id = auth.uid()
          and perm.permission_type = 'properties_view_all'
          and perm.permission_value = true
      )
      or exists (
        select 1 from user_property_access upa
        where upa.user_id = auth.uid() and upa.property_id = p_property_id
      )
    )
  );
$$;

create or replace function public.pode_editar_documentos_do_imovel(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_profiles up
    where up.user_id = auth.uid() and up.role = 'master'
  )
  or (
    not exists (
      select 1 from user_profiles up
      where up.user_id = auth.uid() and up.role = 'faxineira'
    )
    and exists (
      select 1 from user_property_access upa
      where upa.user_id = auth.uid() and upa.property_id = p_property_id
        and (
          upa.access_level = 'full'
          or exists (
            select 1 from user_permissions perm
            where perm.user_id = auth.uid()
              and perm.permission_type = 'properties_edit'
              and perm.permission_value = true
          )
        )
    )
  );
$$;

revoke all on function public.pode_ver_documentos_do_imovel(uuid) from public;
revoke all on function public.pode_editar_documentos_do_imovel(uuid) from public;
grant execute on function public.pode_ver_documentos_do_imovel(uuid) to authenticated;
grant execute on function public.pode_editar_documentos_do_imovel(uuid) to authenticated;

-- 2. Tipos de documento (lista que a IA usa para classificar) -----------------

create table if not exists public.document_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  -- Validade típica em meses, quando o documento não traz a data (ex.: dedetização = 6)
  default_validity_months integer,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

alter table public.document_categories enable row level security;

create policy "Documentos: tipos visíveis para quem está logado"
  on public.document_categories for select to authenticated using (true);

create policy "Documentos: master cuida dos tipos"
  on public.document_categories for all to authenticated
  using (exists (select 1 from user_profiles up where up.user_id = auth.uid() and up.role = 'master'))
  with check (exists (select 1 from user_profiles up where up.user_id = auth.uid() and up.role = 'master'));

insert into public.document_categories (name, description, default_validity_months, sort_order) values
  ('Dedetização', 'Certificado ou comprovante de dedetização, desratização, descupinização', 6, 10),
  ('Contrato de serviço', 'Contrato de prestação de serviço (limpeza, manutenção, administração...)', null, 20),
  ('Contrato de locação', 'Contrato de aluguel ou de administração do imóvel com o proprietário', null, 30),
  ('Seguro', 'Apólice ou proposta de seguro do imóvel', 12, 40),
  ('Vistoria e laudo', 'Vistoria, laudo técnico, AVCB, inspeção de gás ou elétrica', 12, 50),
  ('Manutenção e reparo', 'Orçamento, ordem de serviço ou garantia de manutenção', null, 60),
  ('Limpeza de caixa d''água', 'Certificado de limpeza e higienização de reservatório', 6, 70),
  ('Conta de consumo', 'Luz, água, gás, internet, TV', null, 80),
  ('Condomínio', 'Boleto, ata, regimento ou comunicado do condomínio', null, 90),
  ('IPTU e taxas', 'IPTU, taxa de lixo, taxas municipais', null, 100),
  ('Licença e cadastro', 'Alvará, cadastro de hospedagem, licença municipal', 12, 110),
  ('Escritura e registro', 'Escritura, matrícula, registro do imóvel', null, 120),
  ('Nota fiscal e recibo', 'Nota fiscal ou recibo de compra ou serviço', null, 130),
  ('Outros', 'Qualquer outro documento', null, 999)
on conflict (name) do nothing;

-- 3. Documentos ---------------------------------------------------------------

create table if not exists public.property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  category text not null default 'Outros',
  title text,
  document_date date,
  expires_at date,
  provider text,
  amount numeric,
  summary text,
  notes text,
  -- Texto que a IA leu do documento, para a busca
  content_text text,
  file_path text not null,
  file_name text,
  mime_type text,
  file_size integer,
  -- pendente → lendo → lido | erro
  ai_status text not null default 'pendente' check (ai_status in ('pendente', 'lendo', 'lido', 'erro')),
  ai_error text,
  ai_model text,
  ai_cost numeric,
  ai_read_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists property_documents_property_idx on public.property_documents (property_id, document_date desc);
create index if not exists property_documents_expires_idx on public.property_documents (expires_at) where expires_at is not null;

alter table public.property_documents enable row level security;

create policy "Documentos: ver conforme o acesso ao imóvel"
  on public.property_documents for select to authenticated
  using (public.pode_ver_documentos_do_imovel(property_id));

create policy "Documentos: incluir conforme o acesso ao imóvel"
  on public.property_documents for insert to authenticated
  with check (public.pode_editar_documentos_do_imovel(property_id));

create policy "Documentos: alterar conforme o acesso ao imóvel"
  on public.property_documents for update to authenticated
  using (public.pode_editar_documentos_do_imovel(property_id))
  with check (public.pode_editar_documentos_do_imovel(property_id));

create policy "Documentos: excluir conforme o acesso ao imóvel"
  on public.property_documents for delete to authenticated
  using (public.pode_editar_documentos_do_imovel(property_id));

create or replace function public.property_documents_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists property_documents_touch on public.property_documents;
create trigger property_documents_touch before update on public.property_documents
  for each row execute function public.property_documents_touch();

-- 4. Espaço de arquivos privado -----------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-documents', 'property-documents', false, 15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- A primeira pasta do caminho é o id do imóvel
create or replace function public.imovel_do_arquivo(p_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return (storage.foldername(p_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

create policy "Documentos: abrir arquivo conforme o acesso ao imóvel"
  on storage.objects for select to authenticated
  using (bucket_id = 'property-documents' and public.pode_ver_documentos_do_imovel(public.imovel_do_arquivo(name)));

create policy "Documentos: enviar arquivo conforme o acesso ao imóvel"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'property-documents' and public.pode_editar_documentos_do_imovel(public.imovel_do_arquivo(name)));

create policy "Documentos: trocar arquivo conforme o acesso ao imóvel"
  on storage.objects for update to authenticated
  using (bucket_id = 'property-documents' and public.pode_editar_documentos_do_imovel(public.imovel_do_arquivo(name)));

create policy "Documentos: apagar arquivo conforme o acesso ao imóvel"
  on storage.objects for delete to authenticated
  using (bucket_id = 'property-documents' and public.pode_editar_documentos_do_imovel(public.imovel_do_arquivo(name)));
