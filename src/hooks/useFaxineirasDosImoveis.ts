import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Nomes das faxineiras ligadas aos imóveis (user_id → nome), para mostrar
 * quem faz a faxina de cada saída no Calendário. Usa a mesma função do banco
 * do formulário de reserva (fn_get_cleaners_for_properties).
 */
export const useFaxineirasDosImoveis = (propertyIds: string[]) => {
  const ids = [...propertyIds].sort();
  return useQuery({
    queryKey: ['faxineiras-dos-imoveis', ids],
    enabled: ids.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      // A função não está nos tipos gerados do Supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase.rpc('fn_get_cleaners_for_properties' as any, { property_ids: ids });
      if (error) throw error;
      const mapa = new Map<string, string>();
      for (const f of (data as { user_id?: string; full_name?: string; email?: string }[] | null) || []) {
        if (f.user_id) mapa.set(f.user_id, f.full_name || f.email || 'Faxineira');
      }
      return mapa;
    },
  });
};

/** "Maria Silva Souza" → "Maria S." */
export const nomeCurtoFaxineira = (nome: string) => {
  const p = nome.trim().split(/\s+/);
  const ultimo = p[p.length - 1];
  // Só abrevia sobrenome de verdade (não "Faxineira 2")
  return p.length > 1 && /^\p{L}/u.test(ultimo) ? `${p[0]} ${ultimo.charAt(0)}.` : p.join(' ');
};
