-- Adiciona constraint única para permitir UPSERT na Edge Function create-user
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_destination_role 
ON notification_destinations (user_id, destination_role);