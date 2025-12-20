import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type QueryKey = readonly unknown[];

interface UseRealtimeOptions {
  table: string;
  queryKeys: QueryKey[];
  showToasts?: boolean;
  enabled?: boolean;
}

export const useRealtimeSubscription = ({ 
  table, 
  queryKeys, 
  showToasts = false,
  enabled = true 
}: UseRealtimeOptions) => {
  const queryClient = useQueryClient();
  const queryKeysRef = useRef(queryKeys);
  
  // Keep queryKeys ref updated
  useEffect(() => {
    queryKeysRef.current = queryKeys;
  }, [queryKeys]);

  useEffect(() => {
    if (!enabled) return;

    const channelName = `${table}-realtime-${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
        },
        (payload) => {
          console.log(`[Realtime] ${table}:`, payload.eventType);
          
          // Invalidate all related queries
          queryKeysRef.current.forEach(key => {
            queryClient.invalidateQueries({ queryKey: key });
          });

          // Optional toasts for feedback
          if (showToasts) {
            if (payload.eventType === 'INSERT') {
              toast.success('Novo registro adicionado');
            } else if (payload.eventType === 'UPDATE') {
              toast.info('Registro atualizado');
            } else if (payload.eventType === 'DELETE') {
              toast.warning('Registro removido');
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to ${table}`);
        }
      });

    return () => {
      console.log(`[Realtime] Unsubscribing from ${table}`);
      supabase.removeChannel(channel);
    };
  }, [table, queryClient, showToasts, enabled]);
};
