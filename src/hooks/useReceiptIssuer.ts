import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Dados do emissor dos comprovantes enviados aos hóspedes (um por usuário). */
export interface ReceiptIssuer {
  issuer_name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  footer_note: string | null;
}

export const DEFAULT_RECEIPT_ISSUER: ReceiptIssuer = {
  issuer_name: 'Rioh Host',
  document: null,
  email: null,
  phone: null,
  address: null,
  footer_note: null,
};

export const useReceiptIssuer = () => {
  const [issuer, setIssuer] = useState<ReceiptIssuer>(DEFAULT_RECEIPT_ISSUER);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('receipt_issuer_settings')
        .select('issuer_name, document, email, phone, address, footer_note')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      setIssuer(data ? { ...DEFAULT_RECEIPT_ISSUER, ...data, issuer_name: data.issuer_name || DEFAULT_RECEIPT_ISSUER.issuer_name } : DEFAULT_RECEIPT_ISSUER);
    } catch (error) {
      // Sem os dados, o comprovante sai com o emissor padrão.
      console.warn('Não foi possível carregar o emissor dos comprovantes:', error);
      setIssuer(DEFAULT_RECEIPT_ISSUER);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (dados: ReceiptIssuer) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sessão expirada. Entre novamente.');

    const limpar = (valor: string | null) => (valor && valor.trim() ? valor.trim() : null);
    const registro = {
      user_id: user.id,
      issuer_name: dados.issuer_name.trim() || DEFAULT_RECEIPT_ISSUER.issuer_name,
      document: limpar(dados.document),
      email: limpar(dados.email),
      phone: limpar(dados.phone),
      address: limpar(dados.address),
      footer_note: limpar(dados.footer_note),
    };

    const { error } = await supabase
      .from('receipt_issuer_settings')
      .upsert(registro, { onConflict: 'user_id' });
    if (error) throw error;

    setIssuer({ ...registro });
  }, []);

  return { issuer, loading, save, reload: load };
};
