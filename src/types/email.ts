export interface EmailTemplate {
  id: string;
  user_id: string;
  template_name: string;
  template_type: 'guest' | 'owner' | 'cleaner' | 'manager';
  subject: string;
  body_html: string;
  body_text?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailTrigger {
  id: string;
  template_id: string;
  trigger_type: 'on_booking' | 'before_checkin' | 'after_checkout' | 'custom' | 'on_checkin' | 'mid_stay' | 'before_checkout';
  trigger_offset_minutes?: number;
  custom_datetime?: string;
  is_active: boolean;
  created_at: string;
}

export interface SentEmail {
  id: string;
  reservation_id?: string;
  template_id?: string;
  recipient_email: string;
  recipient_type: 'guest' | 'owner' | 'cleaner' | 'manager';
  sent_at: string;
  status: 'sent' | 'failed' | 'pending';
  error_message?: string;
  created_at: string;
}

export interface EmailTemplateWithTriggers extends EmailTemplate {
  triggers: EmailTrigger[];
}

export type TriggerType = EmailTrigger['trigger_type'];
export type RecipientType = EmailTemplate['template_type'];