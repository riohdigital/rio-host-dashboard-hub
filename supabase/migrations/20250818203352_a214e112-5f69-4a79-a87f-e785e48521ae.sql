
-- 1) Localiza o user_id pelo e-mail e corrige o role para 'faxineira'
with u as (
  select user_id
  from public.user_profiles
  where email = 'contato@parafuzo.com'
  limit 1
)
update public.user_profiles
set role = 'faxineira', updated_at = now()
where user_id in (select user_id from u);

-- 2) Garante que exista um registro em cleaner_profiles para esse usuário
insert into public.cleaner_profiles (user_id, phone, address, notes)
select user_id, null, null, null
from (
  select user_id
  from public.user_profiles
  where email = 'contato@parafuzo.com'
  limit 1
) u
where not exists (
  select 1 from public.cleaner_profiles c where c.user_id = u.user_id
);

-- 3) Remove permissões indevidas de 'owner' (ou quaisquer permissões) desse usuário
delete from public.user_permissions
where user_id in (
  select user_id
  from public.user_profiles
  where email = 'contato@parafuzo.com'
  limit 1
);
