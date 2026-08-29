import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  ChannelSyncRun,
  ChannelSyncSource,
  ReservationSyncPending,
  SyncInvocationResult,
} from '@/types/channelSync';

interface SourceInput {
  property_id: string;
  platform: ChannelSyncSource['platform'];
  ical_url: string;
  listing_alias?: string | null;
  is_active?: boolean;
  dtend_is_checkout?: boolean;
}

export const useChannelSync = () => {
  const [sources, setSources] = useState<ChannelSyncSource[]>([]);
  const [runs, setRuns] = useState<ChannelSyncRun[]>([]);
  const [pending, setPending] = useState<ReservationSyncPending[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [sourcesResult, runsResult, pendingResult] = await Promise.all([
        supabase
          .from('channel_sync_sources')
          .select('*')
          .order('created_at', { ascending: true }),
        supabase
          .from('channel_sync_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(30),
        supabase
          .from('reservation_sync_pending')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (sourcesResult.error) throw sourcesResult.error;
      if (runsResult.error) throw runsResult.error;
      if (pendingResult.error) throw pendingResult.error;

      setSources((sourcesResult.data ?? []) as unknown as ChannelSyncSource[]);
      setRuns((runsResult.data ?? []) as unknown as ChannelSyncRun[]);
      setPending((pendingResult.data ?? []) as unknown as ReservationSyncPending[]);
    } catch (err) {
      console.error('Erro ao carregar sincronização de canais:', err);
      setError('Não foi possível carregar as configurações de sincronização');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const saveSource = useCallback(
    async (input: SourceInput, id?: string) => {
      const payload = {
        property_id: input.property_id,
        platform: input.platform,
        source_type: 'ical' as const,
        ical_url: input.ical_url.trim(),
        listing_alias: input.listing_alias?.trim() || null,
        is_active: input.is_active ?? true,
        dtend_is_checkout: input.dtend_is_checkout ?? true,
      };

      const query = id
        ? supabase.from('channel_sync_sources').update(payload).eq('id', id)
        : supabase.from('channel_sync_sources').insert(payload);

      const { error: saveError } = await query;
      if (saveError) throw saveError;

      await fetchAll();
    },
    [fetchAll],
  );

  const deleteSource = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase
        .from('channel_sync_sources')
        .delete()
        .eq('id', id);
      if (deleteError) throw deleteError;
      await fetchAll();
    },
    [fetchAll],
  );

  const toggleSource = useCallback(
    async (id: string, isActive: boolean) => {
      const { error: toggleError } = await supabase
        .from('channel_sync_sources')
        .update({ is_active: isActive })
        .eq('id', id);
      if (toggleError) throw toggleError;
      await fetchAll();
    },
    [fetchAll],
  );

  /** Dispara a Edge Function de sincronização iCal. */
  const runSync = useCallback(
    async (options: { sourceId?: string; force?: boolean } = {}): Promise<SyncInvocationResult> => {
      setSyncing(true);
      try {
        const { data, error: invokeError } = await supabase.functions.invoke(
          'sync-channel-reservations',
          { body: { sourceId: options.sourceId, force: options.force ?? true } },
        );
        if (invokeError) throw invokeError;
        await fetchAll();
        return data as SyncInvocationResult;
      } finally {
        setSyncing(false);
      }
    },
    [fetchAll],
  );

  const resolvePending = useCallback(
    async (id: string, status: 'resolved' | 'dismissed') => {
      const { data: userData } = await supabase.auth.getUser();
      const { error: updateError } = await supabase
        .from('reservation_sync_pending')
        .update({
          status,
          resolved_at: new Date().toISOString(),
          resolved_by: userData?.user?.id ?? null,
        })
        .eq('id', id);
      if (updateError) throw updateError;
      await fetchAll();
    },
    [fetchAll],
  );

  return {
    sources,
    runs,
    pending,
    loading,
    syncing,
    error,
    refetch: fetchAll,
    saveSource,
    deleteSource,
    toggleSource,
    runSync,
    resolvePending,
  };
};
