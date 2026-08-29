export type SyncPlatform = 'Airbnb' | 'Booking.com';
export type SyncChannel = 'ical' | 'email';
export type SyncRunStatus = 'success' | 'partial' | 'error' | 'skipped';
export type PendingKind =
  | 'unmatched_property'
  | 'incomplete_data'
  | 'possible_cancellation'
  | 'conflict';
export type PendingStatus = 'pending' | 'resolved' | 'dismissed';

export interface ChannelSyncSource {
  id: string;
  property_id: string;
  platform: SyncPlatform;
  source_type: 'ical';
  ical_url: string | null;
  listing_alias: string | null;
  is_active: boolean;
  dtend_is_checkout: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
  last_content_hash: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ChannelSyncRun {
  id: string;
  source_id: string | null;
  property_id: string | null;
  channel: SyncChannel;
  platform: string | null;
  status: SyncRunStatus;
  events_found: number;
  reservations_created: number;
  reservations_updated: number;
  reservations_skipped: number;
  pending_created: number;
  message: string | null;
  details: unknown;
  started_at: string;
  finished_at: string | null;
}

export interface ReservationSyncPending {
  id: string;
  channel: SyncChannel;
  platform: string | null;
  property_id: string | null;
  reservation_id: string | null;
  kind: PendingKind;
  dedupe_key: string;
  status: PendingStatus;
  summary: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface SyncSourceResult {
  sourceId: string;
  propertyId: string;
  platform: string;
  status: SyncRunStatus;
  eventsFound: number;
  created: number;
  updated: number;
  skipped: number;
  pending: number;
  message?: string;
}

export interface SyncInvocationResult {
  ok: boolean;
  totals: { created: number; updated: number; skipped: number; pending: number };
  results: SyncSourceResult[];
  message?: string;
}

export const PENDING_KIND_LABELS: Record<PendingKind, string> = {
  unmatched_property: 'Propriedade não identificada',
  incomplete_data: 'Dados incompletos',
  possible_cancellation: 'Possível cancelamento',
  conflict: 'Conflito de datas',
};
