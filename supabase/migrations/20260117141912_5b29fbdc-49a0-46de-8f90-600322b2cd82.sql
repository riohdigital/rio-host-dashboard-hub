-- Remove a constraint que impede múltiplos destinatários com o mesmo papel por user_id
ALTER TABLE notification_destinations 
DROP CONSTRAINT IF EXISTS unique_user_destination_role;

-- Cria nova constraint que permite múltiplos por papel (diferenciados por nome)
CREATE UNIQUE INDEX IF NOT EXISTS unique_destination_name_role 
ON notification_destinations (destination_name, destination_role);