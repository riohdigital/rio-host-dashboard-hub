-- Remove a permissão expenses_view para o usuário rioh.host@gmail.com 
-- para que ele veja apenas despesas das propriedades que tem acesso
DELETE FROM user_permissions 
WHERE user_id = 'f407632e-e5f6-4b61-bc0d-154256886bc8' 
AND permission_type = 'expenses_view';

-- Remove a permissão investments_view para o usuário rioh.host@gmail.com 
-- para que ele veja apenas investimentos das propriedades que tem acesso  
DELETE FROM user_permissions 
WHERE user_id = 'f407632e-e5f6-4b61-bc0d-154256886bc8' 
AND permission_type = 'investments_view';