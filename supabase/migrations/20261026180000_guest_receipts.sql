-- Comprovante do Hóspede
--
-- 1. reservations.guest_total_paid: quanto o HÓSPEDE pagou pela estadia.
--    Diferente de total_revenue, que é o lado do anfitrião (repasse depois da
--    taxa da plataforma). Preenchido pela sincronização (e-mail do Airbnb:
--    bloco "O HÓSPEDE PAGOU"; e-mail do Booking: "Preço total") ou à mão no
--    formulário. Nulo em reserva Direta significa "igual a total_revenue".
--
-- 2. receipt_issuer_settings: dados do emissor dos comprovantes, um registro
--    por usuário (multi-inquilino). Sem registro, o front usa "Rioh Host".

alter table public.reservations
  add column if not exists guest_total_paid numeric(12, 2);

comment on column public.reservations.guest_total_paid is
  'Valor total pago pelo hóspede pela estadia (lado do hóspede, inclui taxas da plataforma). Nulo em reserva Direta = total_revenue.';

create table if not exists public.receipt_issuer_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  issuer_name text not null default 'Rioh Host',
  document text,
  email text,
  phone text,
  address text,
  footer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.receipt_issuer_settings is
  'Dados do emissor dos comprovantes enviados aos hóspedes, um registro por usuário.';

alter table public.receipt_issuer_settings enable row level security;

create policy "Emissor: dono lê o próprio"
  on public.receipt_issuer_settings for select
  to authenticated
  using (user_id = auth.uid());

create policy "Emissor: dono cria o próprio"
  on public.receipt_issuer_settings for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Emissor: dono edita o próprio"
  on public.receipt_issuer_settings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.receipt_issuer_settings_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists receipt_issuer_settings_touch on public.receipt_issuer_settings;
create trigger receipt_issuer_settings_touch
  before update on public.receipt_issuer_settings
  for each row execute function public.receipt_issuer_settings_touch();
