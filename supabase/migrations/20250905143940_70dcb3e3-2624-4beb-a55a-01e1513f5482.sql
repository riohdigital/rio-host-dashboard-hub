-- Fase 1.1: Adicionar campo e-mail do hóspede na tabela reservations
ALTER TABLE public.reservations 
ADD COLUMN guest_email text;

-- Fase 1.2: Criar tabelas para sistema de e-mails

-- Tabela para armazenar templates de e-mail personalizáveis
CREATE TABLE public.email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  template_type text NOT NULL CHECK (template_type IN ('guest', 'owner', 'cleaner', 'manager')),
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela para definir quando cada template deve ser enviado
CREATE TABLE public.email_triggers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  trigger_type text NOT NULL CHECK (trigger_type IN ('on_booking', 'before_checkin', 'after_checkout', 'custom', 'on_checkin', 'mid_stay', 'before_checkout')),
  trigger_offset_minutes integer, -- Para triggers relativos (ex: 1440 para 1 dia)
  custom_datetime timestamp with time zone, -- Para triggers em data/hora específica
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela para log de e-mails enviados
CREATE TABLE public.sent_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  recipient_type text NOT NULL CHECK (recipient_type IN ('guest', 'owner', 'cleaner', 'manager')),
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;

-- Criar triggers para updated_at
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Políticas RLS para email_templates
CREATE POLICY "Masters can manage all email templates"
  ON public.email_templates
  FOR ALL
  USING (get_current_user_role() = 'master');

CREATE POLICY "Users can manage own email templates with permission"
  ON public.email_templates
  FOR ALL
  USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_permissions perm
      WHERE perm.user_id = auth.uid() 
      AND perm.permission_type IN ('email_templates_view', 'email_templates_create', 'email_templates_edit', 'email_templates_delete')
      AND perm.permission_value = true
    )
  );

-- Políticas RLS para email_triggers
CREATE POLICY "Masters can manage all email triggers"
  ON public.email_triggers
  FOR ALL
  USING (get_current_user_role() = 'master');

CREATE POLICY "Users can manage triggers for own templates"
  ON public.email_triggers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.email_templates et
      WHERE et.id = email_triggers.template_id 
      AND et.user_id = auth.uid()
    )
  );

-- Políticas RLS para sent_emails
CREATE POLICY "Masters can view all sent emails"
  ON public.sent_emails
  FOR SELECT
  USING (get_current_user_role() = 'master');

CREATE POLICY "Users can view sent emails for accessible reservations"
  ON public.sent_emails
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      JOIN public.user_property_access upa ON r.property_id = upa.property_id
      WHERE r.id = sent_emails.reservation_id 
      AND upa.user_id = auth.uid()
    )
  );

-- Índices para performance
CREATE INDEX idx_email_templates_user_id ON public.email_templates(user_id);
CREATE INDEX idx_email_templates_type ON public.email_templates(template_type);
CREATE INDEX idx_email_triggers_template_id ON public.email_triggers(template_id);
CREATE INDEX idx_email_triggers_type ON public.email_triggers(trigger_type);
CREATE INDEX idx_sent_emails_reservation_id ON public.sent_emails(reservation_id);
CREATE INDEX idx_sent_emails_template_id ON public.sent_emails(template_id);
CREATE INDEX idx_sent_emails_recipient_email ON public.sent_emails(recipient_email);

-- Fase 1.3: Adicionar novas permissões granulares para sistema de e-mails
-- Estas permissões serão inseridas automaticamente para usuários 'owner' pelo trigger handle_new_user()
-- Para usuários existentes, elas precisarão ser atribuídas manualmente pelos masters