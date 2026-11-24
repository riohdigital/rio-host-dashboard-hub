/**
 * Documentos dos imóveis: lista, envio, leitura por IA, edição e exclusão.
 *
 * O arquivo vai para o espaço privado `property-documents`, na pasta do
 * imóvel; a linha vai para `property_documents`. Depois do envio, a Edge
 * Function `ler-documento` lê o arquivo com IA e preenche tipo, título, datas,
 * fornecedor, valor, resumo e o texto usado na busca.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type Documento = Database['public']['Tables']['property_documents']['Row'];
export type TipoDocumento = Database['public']['Tables']['document_categories']['Row'];
export type CamposEditaveis = Pick<Documento, 'category' | 'title' | 'document_date' | 'expires_at' | 'provider' | 'amount' | 'notes'>;
/** O que a tela grava ao salvar a edição (a validade digitada deixa de ser estimada) */
export type CamposSalvos = Partial<CamposEditaveis> & { expires_estimated?: boolean };

export const ESPACO_DOCUMENTOS = 'property-documents';
export const TAMANHO_MAXIMO = 15 * 1024 * 1024;
export const TIPOS_ACEITOS = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif';

const extensao = (arquivo: File) => {
  const pelaParte = arquivo.name.includes('.') ? arquivo.name.split('.').pop()!.toLowerCase() : '';
  if (pelaParte) return pelaParte.replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
  if (arquivo.type === 'application/pdf') return 'pdf';
  return arquivo.type.split('/')[1] || 'bin';
};

/** Sem acento e em minúsculas, para a busca */
export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Dias até a validade (negativo = vencido); null sem validade */
export function diasParaVencer(doc: Pick<Documento, 'expires_at'>, hoje = new Date()): number | null {
  if (!doc.expires_at) return null;
  const [a, m, d] = doc.expires_at.slice(0, 10).split('-').map(Number);
  const alvo = Date.UTC(a, m - 1, d);
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 86400000);
}

/** Vence em até 30 dias, ou já venceu */
export const ATENCAO_DIAS = 30;

export function useDocumentos() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [tipos, setTipos] = useState<TipoDocumento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [docs, cats] = await Promise.all([
      supabase.from('property_documents').select('*').order('document_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
      supabase.from('document_categories').select('*').order('sort_order'),
    ]);
    if (docs.error) setErro('Não foi possível carregar os documentos.');
    else {
      setErro(null);
      setDocumentos(docs.data ?? []);
    }
    if (!cats.error) setTipos(cats.data ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const trocar = useCallback((doc: Documento) => {
    setDocumentos((lista) => {
      const existe = lista.some((d) => d.id === doc.id);
      return existe ? lista.map((d) => (d.id === doc.id ? doc : d)) : [doc, ...lista];
    });
  }, []);

  /** Pede à IA para ler (ou reler) o documento. Devolve o documento atualizado. */
  const lerComIA = useCallback(async (id: string): Promise<{ ok: boolean; erro?: string }> => {
    setDocumentos((lista) => lista.map((d) => (d.id === id ? { ...d, ai_status: 'lendo', ai_error: null } : d)));
    const { data, error } = await supabase.functions.invoke('ler-documento', { body: { documentId: id } });
    const resposta = data as { ok?: boolean; error?: string; documento?: Documento } | null;
    if (resposta?.documento) trocar(resposta.documento);
    else {
      const { data: atual } = await supabase.from('property_documents').select('*').eq('id', id).maybeSingle();
      if (atual) trocar(atual);
    }
    if (error || !resposta?.ok) return { ok: false, erro: resposta?.error || 'A IA não conseguiu ler este documento.' };
    return { ok: true };
  }, [trocar]);

  /** Envia o arquivo, cria a linha e já pede a leitura por IA */
  const enviar = useCallback(async (imovelId: string, arquivo: File, observacao?: string): Promise<{ ok: boolean; erro?: string; id?: string }> => {
    if (arquivo.size > TAMANHO_MAXIMO) return { ok: false, erro: `${arquivo.name}: maior que 15 MB.` };
    const id = crypto.randomUUID();
    const caminho = `${imovelId}/${id}.${extensao(arquivo)}`;
    const { error: erroArquivo } = await supabase.storage.from(ESPACO_DOCUMENTOS).upload(caminho, arquivo, {
      contentType: arquivo.type || undefined,
      upsert: false,
    });
    if (erroArquivo) return { ok: false, erro: `${arquivo.name}: não foi possível enviar (${erroArquivo.message}).` };

    const { data, error } = await supabase
      .from('property_documents')
      .insert({
        id,
        property_id: imovelId,
        file_path: caminho,
        file_name: arquivo.name,
        mime_type: arquivo.type || null,
        file_size: arquivo.size,
        notes: observacao?.trim() || null,
        title: arquivo.name.replace(/\.[^.]+$/, ''),
      })
      .select('*')
      .single();
    if (error || !data) {
      await supabase.storage.from(ESPACO_DOCUMENTOS).remove([caminho]);
      return { ok: false, erro: `${arquivo.name}: não foi possível salvar.` };
    }
    trocar(data);
    const leitura = await lerComIA(id);
    return { ok: true, id, erro: leitura.ok ? undefined : leitura.erro };
  }, [lerComIA, trocar]);

  const atualizar = useCallback(async (id: string, campos: CamposSalvos) => {
    const { data, error } = await supabase.from('property_documents').update(campos).eq('id', id).select('*').single();
    if (error || !data) return false;
    trocar(data);
    return true;
  }, [trocar]);

  const excluir = useCallback(async (doc: Documento) => {
    const { error } = await supabase.from('property_documents').delete().eq('id', doc.id);
    if (error) return false;
    await supabase.storage.from(ESPACO_DOCUMENTOS).remove([doc.file_path]);
    setDocumentos((lista) => lista.filter((d) => d.id !== doc.id));
    return true;
  }, []);

  /** Link temporário (10 minutos) para abrir o arquivo */
  const linkDoArquivo = useCallback(async (doc: Documento) => {
    const { data, error } = await supabase.storage.from(ESPACO_DOCUMENTOS).createSignedUrl(doc.file_path, 600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }, []);

  return { documentos, tipos, carregando, erro, carregar, enviar, lerComIA, atualizar, excluir, linkDoArquivo };
}
