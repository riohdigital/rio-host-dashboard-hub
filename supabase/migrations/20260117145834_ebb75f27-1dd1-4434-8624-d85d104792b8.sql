-- Adicionar campo para identificar perfis criados apenas para destinatários
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_destination_only BOOLEAN DEFAULT false;

-- Adicionar campo para saber quem criou o usuário
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Índice para consultas otimizadas de perfis destination-only
CREATE INDEX IF NOT EXISTS idx_user_profiles_destination_only 
ON user_profiles (is_destination_only) WHERE is_destination_only = true;

-- Índice para consultas por created_by
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_by 
ON user_profiles (created_by) WHERE created_by IS NOT NULL;