/**
 * ler-documento
 *
 * Lê um documento de imóvel com IA e preenche tipo, título, datas, fornecedor,
 * valor, resumo e texto para a busca.
 *
 * Recebe { documentId }. Tudo é feito com o login de quem pediu: só lê e grava
 * se as regras do banco permitirem a essa pessoa editar os documentos do
 * imóvel. A chave do OpenRouter fica no segredo OPENROUTER_API_KEY.
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

import { corsHeaders, jsonResponse } from '../_shared/reservationSync.ts';
import {
  conferirLeitura,
  extrairJson,
  MODELO_LEITURA,
  montarPedido,
  paraBase64,
  tipoDoArquivo,
  type TipoDocumento,
} from '../_shared/leituraDocumento.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

const LIMITE_BYTES = 15 * 1024 * 1024;

interface RespostaOpenRouter {
  model?: string;
  error?: { message?: string };
  usage?: { cost?: number };
  choices?: { message?: { content?: unknown } }[];
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return jsonResponse({ error: 'Não autorizado' }, 401);

  const db = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await db.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: 'Não autorizado' }, 401);

  let documentId = '';
  try {
    documentId = String((await req.json())?.documentId || '');
  } catch {
    return jsonResponse({ error: 'Pedido inválido' }, 400);
  }
  if (!documentId) return jsonResponse({ error: 'Falta o documento' }, 400);

  const { data: doc, error: docError } = await db
    .from('property_documents')
    .select('id, property_id, file_path, file_name, mime_type, properties(name, nickname)')
    .eq('id', documentId)
    .maybeSingle();
  if (docError || !doc) return jsonResponse({ error: 'Documento não encontrado' }, 404);

  const { data: podeEditar } = await db.rpc('pode_editar_documentos_do_imovel', { p_property_id: doc.property_id });
  if (!podeEditar) return jsonResponse({ error: 'Sem permissão para este imóvel' }, 403);

  const falhar = async (mensagem: string, status = 200) => {
    await db.from('property_documents').update({ ai_status: 'erro', ai_error: mensagem }).eq('id', documentId);
    return jsonResponse({ ok: false, error: mensagem }, status);
  };

  if (!OPENROUTER_API_KEY) return falhar('A leitura por IA não está configurada (falta OPENROUTER_API_KEY).');

  await db.from('property_documents').update({ ai_status: 'lendo', ai_error: null }).eq('id', documentId);

  const { data: arquivo, error: arquivoError } = await db.storage.from('property-documents').download(doc.file_path);
  if (arquivoError || !arquivo) return falhar('Não foi possível abrir o arquivo.');
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (bytes.length > LIMITE_BYTES) return falhar('Arquivo maior que 15 MB.');

  const { data: tiposData } = await db
    .from('document_categories')
    .select('name, description, default_validity_months')
    .order('sort_order');
  const tipos: TipoDocumento[] = tiposData?.length ? tiposData : [{ name: 'Outros' }];

  const imovel = doc.properties?.nickname || doc.properties?.name || 'imóvel';
  const mime = tipoDoArquivo(doc.mime_type, doc.file_name);
  const pedido = montarPedido({ base64: paraBase64(bytes), mime, nomeArquivo: doc.file_name || 'documento', tipos, imovel });

  let resposta: RespostaOpenRouter;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://anfitriao.rioh.digital',
        'X-Title': 'Rioh Host - Documentos',
      },
      body: JSON.stringify(pedido),
    });
    resposta = (await r.json()) as RespostaOpenRouter;
    if (!r.ok) {
      console.error('OpenRouter', r.status, JSON.stringify(resposta).slice(0, 500));
      return falhar(`A IA não conseguiu ler (${resposta?.error?.message || r.status}).`);
    }
  } catch (e) {
    console.error('OpenRouter', e);
    return falhar('A IA não respondeu. Tente de novo.');
  }

  const conteudo = resposta.choices?.[0]?.message?.content;
  const bruto = extrairJson(conteudo);
  if (!bruto) return falhar('A IA respondeu fora do formato. Tente de novo.');
  const leitura = conferirLeitura(bruto, tipos);

  const atualizacao = {
    category: leitura.categoria,
    title: leitura.titulo,
    document_date: leitura.data_documento,
    expires_at: leitura.validade,
    expires_estimated: leitura.validade_estimada,
    provider: leitura.fornecedor,
    amount: leitura.valor,
    summary: leitura.resumo,
    content_text: leitura.texto,
    ai_status: 'lido',
    ai_error: null,
    ai_model: resposta.model || MODELO_LEITURA,
    ai_cost: typeof resposta.usage?.cost === 'number' ? resposta.usage.cost : null,
    ai_read_at: new Date().toISOString(),
  };

  const { data: salvo, error: salvarError } = await db
    .from('property_documents')
    .update(atualizacao)
    .eq('id', documentId)
    .select('*')
    .maybeSingle();
  if (salvarError) return falhar('Leu o documento, mas não conseguiu salvar.');

  return jsonResponse({ ok: true, documento: salvo });
});
