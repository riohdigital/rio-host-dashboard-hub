/**
 * Leitura de documentos de imóvel por IA: monta o pedido ao modelo e confere a
 * resposta. Fica separado da Edge Function `ler-documento` para poder ser
 * testado com `node --experimental-strip-types`, sem Deno.
 *
 * Modelo: Gemini 2.5 Flash-Lite pelo OpenRouter, o mais barato que lê PDF e
 * foto direto (US$ 0,10 por milhão de tokens de entrada). Um documento de
 * 1 a 3 páginas custa por volta de US$ 0,0005.
 */

export const MODELO_LEITURA = 'google/gemini-2.5-flash-lite';

export interface TipoDocumento {
  name: string;
  description?: string | null;
  default_validity_months?: number | null;
}

export interface LeituraDocumento {
  categoria: string;
  titulo: string | null;
  data_documento: string | null;
  validade: string | null;
  validade_estimada: boolean;
  fornecedor: string | null;
  valor: number | null;
  resumo: string | null;
  texto: string | null;
}

/** Converte bytes em base64 sem estourar a pilha em arquivos grandes */
export function paraBase64(bytes: Uint8Array): string {
  let binario = '';
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) {
    binario += String.fromCharCode(...bytes.subarray(i, i + passo));
  }
  return btoa(binario);
}

/** Tipo do arquivo pelo conteúdo informado ou pela extensão */
export function tipoDoArquivo(mime: string | null | undefined, nome: string | null | undefined): string {
  if (mime && mime !== 'application/octet-stream') return mime;
  const ext = (nome || '').toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
}

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['categoria', 'titulo', 'data_documento', 'validade', 'fornecedor', 'valor', 'resumo', 'texto'],
  properties: {
    categoria: { type: 'string', description: 'Um dos tipos da lista, escrito igual' },
    titulo: { type: 'string', description: 'Título curto, até 60 caracteres. Ex.: "Dedetização Insetisan"' },
    data_documento: { type: ['string', 'null'], description: 'Data do serviço ou da emissão, AAAA-MM-DD' },
    validade: { type: ['string', 'null'], description: 'Data de validade ou fim do contrato/garantia, AAAA-MM-DD, só se estiver escrita' },
    fornecedor: { type: ['string', 'null'], description: 'Empresa ou pessoa que emitiu ou prestou o serviço' },
    valor: { type: ['number', 'null'], description: 'Valor total em reais, se houver' },
    resumo: { type: 'string', description: 'Uma ou duas frases: o que é, o que foi feito, condições importantes' },
    texto: { type: 'string', description: 'O texto principal do documento, até 1500 caracteres, para busca' },
  },
};

export function montarPedido(opcoes: {
  base64: string;
  mime: string;
  nomeArquivo: string;
  tipos: TipoDocumento[];
  imovel: string;
}) {
  const { base64, mime, nomeArquivo, tipos, imovel } = opcoes;
  const lista = tipos.map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ''}`).join('\n');
  const instrucao = [
    'Você organiza documentos de imóveis de aluguel por temporada no Brasil.',
    `O documento é do imóvel "${imovel}". Leia e devolva só o JSON pedido, em português do Brasil.`,
    'Escolha a categoria exatamente entre estes tipos:',
    lista,
    'Regras: datas em AAAA-MM-DD; não invente datas nem valores; se algo não estiver no documento, use null.',
    'Validade: só preencha se o documento disser a data, o prazo de garantia ou a vigência (calcule a data quando vier em dias ou meses a partir da data do serviço).',
  ].join('\n');

  const arquivo = mime === 'application/pdf'
    ? { type: 'file', file: { filename: nomeArquivo || 'documento.pdf', file_data: `data:application/pdf;base64,${base64}` } }
    : { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } };

  return {
    model: MODELO_LEITURA,
    temperature: 0,
    max_tokens: 1200,
    // O Gemini lê PDF nativamente; sem isto o OpenRouter poderia usar um OCR pago à parte
    plugins: [{ id: 'file-parser', pdf: { engine: 'native' } }],
    response_format: { type: 'json_schema', json_schema: { name: 'documento', strict: true, schema: ESQUEMA } },
    usage: { include: true },
    messages: [
      { role: 'system', content: instrucao },
      { role: 'user', content: [{ type: 'text', text: `Arquivo: ${nomeArquivo}` }, arquivo] },
    ],
  };
}

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data AAAA-MM-DD válida e plausível (1990 até 30 anos à frente) */
export function dataValida(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = DATA.exec(v.trim());
  if (!m) return null;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(a, me - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== me - 1 || dt.getUTCDate() !== d) return null;
  const anoAtual = new Date().getUTCFullYear();
  if (a < 1990 || a > anoAtual + 30) return null;
  return v.trim();
}

/** Soma meses a uma data AAAA-MM-DD, segurando no último dia do mês */
export function somarMeses(data: string, meses: number): string {
  const [a, m, d] = data.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

const texto = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+\n/g, '\n').trim();
  return t ? t.slice(0, max) : null;
};

/** Normaliza (sem acentos, minúsculas) para comparar nomes de tipo */
const chave = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Confere a resposta do modelo: tipo dentro da lista, datas válidas, valor
 * numérico. Sem validade escrita, usa a validade típica do tipo (ex.:
 * dedetização = 6 meses) e marca como estimada.
 */
export function conferirLeitura(bruto: unknown, tipos: TipoDocumento[]): LeituraDocumento {
  const r = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
  const pedido = typeof r.categoria === 'string' ? chave(r.categoria) : '';
  const tipo = tipos.find((t) => chave(t.name) === pedido)
    ?? tipos.find((t) => pedido && (chave(t.name).includes(pedido) || pedido.includes(chave(t.name))))
    ?? tipos.find((t) => chave(t.name) === 'outros')
    ?? { name: 'Outros' };

  const dataDocumento = dataValida(r.data_documento);
  let validade = dataValida(r.validade);
  if (validade && dataDocumento && validade < dataDocumento) validade = null;
  let estimada = false;
  if (!validade && dataDocumento && tipo.default_validity_months) {
    validade = somarMeses(dataDocumento, tipo.default_validity_months);
    estimada = true;
  }

  let valor: number | null = null;
  if (typeof r.valor === 'number' && Number.isFinite(r.valor) && r.valor > 0) valor = Math.round(r.valor * 100) / 100;
  else if (typeof r.valor === 'string') {
    const n = Number(r.valor.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
    if (Number.isFinite(n) && n > 0) valor = Math.round(n * 100) / 100;
  }

  return {
    categoria: tipo.name,
    titulo: texto(r.titulo, 80),
    data_documento: dataDocumento,
    validade,
    validade_estimada: estimada,
    fornecedor: texto(r.fornecedor, 120),
    valor,
    resumo: texto(r.resumo, 600),
    texto: texto(r.texto, 4000),
  };
}

/** Lê o JSON da resposta, mesmo que venha dentro de ```json ... ``` */
export function extrairJson(conteudo: unknown): unknown {
  if (conteudo && typeof conteudo === 'object') return conteudo;
  if (typeof conteudo !== 'string') return null;
  const limpo = conteudo.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(limpo);
  } catch {
    const ini = limpo.indexOf('{');
    const fim = limpo.lastIndexOf('}');
    if (ini >= 0 && fim > ini) {
      try { return JSON.parse(limpo.slice(ini, fim + 1)); } catch { return null; }
    }
    return null;
  }
}
