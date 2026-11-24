/**
 * Documentos dos imóveis (aba "Documentos" de Propriedades).
 *
 * Busca no que a IA leu (título, tipo, fornecedor, resumo e texto do
 * documento), filtro por imóvel, aviso do que vence em até 30 dias, lista por
 * imóvel e folha de detalhes com o arquivo, a leitura da IA e a edição.
 * Enviar: escolhe o imóvel e um ou mais arquivos (PDF ou foto); cada arquivo
 * vira um documento e a IA lê na hora.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  FolderOpen,
  ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  Upload,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BarraBusca, { BotaoBarra } from '@/components/comum/BarraBusca';
import Bloco from '@/components/comum/Bloco';
import EstadoVazio from '@/components/comum/EstadoVazio';
import FolhaDetalhes from '@/components/comum/FolhaDetalhes';
import GrupoLista from '@/components/comum/GrupoLista';
import JanelaResponsiva from '@/components/comum/JanelaResponsiva';
import LinhaLista from '@/components/comum/LinhaLista';
import MarcaIA from '@/components/comum/MarcaIA';
import { Etiqueta } from '@/components/comum/Etiquetas';
import type { Tom } from '@/components/comum/cores';
import { formatarData, formatarMoeda } from '@/components/comum/formatos';
import { useToast } from '@/hooks/use-toast';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';
import { useItemAberto } from '@/hooks/useItemAberto';
import type { Property } from '@/types/property';
import {
  ATENCAO_DIAS,
  diasParaVencer,
  semAcento,
  TIPOS_ACEITOS,
  useDocumentos,
  type CamposEditaveis,
  type CamposSalvos,
  type Documento,
  type TipoDocumento,
} from './useDocumentos';

export const TODOS_OS_IMOVEIS = 'todos';
const TODOS = TODOS_OS_IMOVEIS;

const nomeDoImovel = (p?: Pick<Property, 'nickname' | 'name'> | null) => p?.nickname || p?.name || 'Imóvel';

const tamanho = (bytes?: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
};

/** Texto e tom da validade */
function situacaoDaValidade(doc: Documento): { texto: string; legenda: string; tom: Tom } | null {
  const dias = diasParaVencer(doc);
  if (dias === null) return null;
  const data = formatarData(doc.expires_at, true);
  if (dias < 0) return { texto: `venceu ${data}`, legenda: `há ${-dias} dia${dias === -1 ? '' : 's'}`, tom: 'danger' };
  if (dias === 0) return { texto: `vence hoje`, legenda: data, tom: 'danger' };
  if (dias <= ATENCAO_DIAS) return { texto: `vence ${data}`, legenda: `em ${dias} dia${dias === 1 ? '' : 's'}`, tom: 'warning' };
  const [a, m] = (doc.expires_at || '').split('-');
  return { texto: `até ${m}/${a}`, legenda: doc.expires_estimated ? 'validade típica' : 'validade', tom: 'neutro' };
}

const ehImagem = (doc: Documento) => (doc.mime_type || '').startsWith('image/');

/** Abre o arquivo numa aba nova. A aba abre antes do link existir, senão o celular bloqueia. */
async function abrirArquivo(doc: Documento, gerarLink: (d: Documento) => Promise<string | null>) {
  const aba = window.open('', '_blank');
  const link = await gerarLink(doc);
  if (!link) {
    aba?.close();
    return false;
  }
  if (aba) aba.location.href = link;
  else window.location.href = link;
  return true;
}

interface DocumentosImoveisProps {
  imoveis: Property[];
  /** Imóvel escolhido no filtro ('todos' = todos); fica com quem abre a aba, para o cartão do imóvel abrir já filtrado */
  filtroImovel: string;
  aoMudarFiltroImovel: (id: string) => void;
  /** Pode enviar, editar e excluir documentos deste imóvel? */
  podeEditar: (imovelId: string) => boolean;
}

const DocumentosImoveis = ({ imoveis, podeEditar, filtroImovel, aoMudarFiltroImovel: setFiltroImovel }: DocumentosImoveisProps) => {
  const { toast } = useToast();
  const { documentos, tipos, carregando, erro, enviar, lerComIA, atualizar, excluir, linkDoArquivo } = useDocumentos();
  const [busca, setBusca] = useEstadoPersistente('documentos.busca', '');
  const folha = useItemAberto<Documento>('documentos.folha', documentos, { carregando });
  const [envioAberto, setEnvioAberto] = useEstadoPersistente('documentos.envio', false);

  const imovelPorId = useMemo(() => new Map(imoveis.map((p) => [p.id, p])), [imoveis]);
  const imovelFiltrado = filtroImovel !== TODOS && imovelPorId.has(filtroImovel) ? filtroImovel : TODOS;
  const imoveisEditaveis = useMemo(() => imoveis.filter((p) => podeEditar(p.id)), [imoveis, podeEditar]);

  // Só os documentos dos imóveis que esta pessoa vê na tela
  const doUsuario = useMemo(() => documentos.filter((d) => imovelPorId.has(d.property_id)), [documentos, imovelPorId]);

  const filtrados = useMemo(() => {
    const termos = semAcento(busca.trim()).split(/\s+/).filter(Boolean);
    return doUsuario.filter((d) => {
      if (imovelFiltrado !== TODOS && d.property_id !== imovelFiltrado) return false;
      if (!termos.length) return true;
      const alvo = semAcento(
        [d.title, d.category, d.provider, d.summary, d.content_text, d.notes, d.file_name, nomeDoImovel(imovelPorId.get(d.property_id)), formatarData(d.document_date)]
          .filter(Boolean)
          .join(' '),
      );
      return termos.every((t) => alvo.includes(t));
    });
  }, [doUsuario, busca, imovelFiltrado, imovelPorId]);

  const atencao = useMemo(
    () =>
      doUsuario
        .filter((d) => {
          const dias = diasParaVencer(d);
          return dias !== null && dias <= ATENCAO_DIAS && (imovelFiltrado === TODOS || d.property_id === imovelFiltrado);
        })
        .sort((a, b) => (a.expires_at || '').localeCompare(b.expires_at || '')),
    [doUsuario, imovelFiltrado],
  );

  const grupos = useMemo(() => {
    const mapa = new Map<string, Documento[]>();
    for (const d of filtrados) {
      if (!mapa.has(d.property_id)) mapa.set(d.property_id, []);
      mapa.get(d.property_id)!.push(d);
    }
    return [...mapa.entries()].sort((a, b) => nomeDoImovel(imovelPorId.get(a[0])).localeCompare(nomeDoImovel(imovelPorId.get(b[0])), 'pt-BR'));
  }, [filtrados, imovelPorId]);

  const linha = (d: Documento, mostrarImovel = false) => {
    const validade = situacaoDaValidade(d);
    const partes = [
      mostrarImovel ? nomeDoImovel(imovelPorId.get(d.property_id)) : d.category,
      d.document_date ? formatarData(d.document_date) : null,
      !mostrarImovel ? d.provider : null,
    ].filter(Boolean);
    return (
      <LinhaLista
        key={d.id}
        icone={ehImagem(d) ? ImageIcon : FileText}
        tomIcone={d.ai_status === 'erro' ? 'warning' : 'brand'}
        titulo={d.title || d.file_name || 'Documento'}
        subtitulo={partes.join(' · ')}
        etiqueta={
          d.ai_status === 'lendo' || d.ai_status === 'pendente' ? (
            <Etiqueta tom="brand"><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />Lendo</Etiqueta>
          ) : d.ai_status === 'erro' ? (
            <Etiqueta tom="warning">Sem leitura</Etiqueta>
          ) : undefined
        }
        valor={validade?.texto}
        legenda={validade?.legenda}
        tomLegenda={validade?.tom === 'neutro' ? undefined : validade?.tom}
        aoTocar={() => folha.abrir(d)}
      />
    );
  };

  const opcoesImovel = (
    <Select value={imovelFiltrado} onValueChange={setFiltroImovel}>
      <SelectTrigger className="h-11 min-w-0 bg-card sm:w-64" aria-label="Imóvel">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>Todos os imóveis</SelectItem>
        {imoveis.map((p) => (
          <SelectItem key={p.id} value={p.id}>{nomeDoImovel(p)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <div className="grid min-w-0 gap-2 sm:flex sm:items-center">
        <BarraBusca valor={busca} aoMudar={setBusca} placeholder="Buscar documento" className="min-w-0 flex-1">
          {imoveisEditaveis.length > 0 && (
            <BotaoBarra icone={Upload} rotulo="Enviar documento" texto="Enviar" primario aoClicar={() => setEnvioAberto(true)} />
          )}
        </BarraBusca>
        {opcoesImovel}
      </div>

      {erro && <p className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{erro}</p>}

      {atencao.length > 0 && !busca.trim() && (
        <Bloco titulo="Vencendo" tom="alerta" compacto extra={<span className="font-mono text-xs text-gray-500">{atencao.length}</span>}>
          <div className="divide-y divide-gray-100">{atencao.map((d) => linha(d, true))}</div>
        </Bloco>
      )}

      {carregando ? (
        <div className="grid gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-100" />)}
        </div>
      ) : doUsuario.length === 0 ? (
        <EstadoVazio
          icone={FolderOpen}
          titulo="Nenhum documento ainda"
          descricao="Envie o PDF ou a foto de uma dedetização, contrato ou seguro. A IA lê, classifica e guarda as datas."
          acao={imoveisEditaveis.length > 0 ? <Button onClick={() => setEnvioAberto(true)} className="gap-2"><Upload className="h-4 w-4" />Enviar documento</Button> : undefined}
        />
      ) : filtrados.length === 0 ? (
        <EstadoVazio icone={FolderOpen} titulo="Nada encontrado" descricao="Tente outra palavra ou outro imóvel." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {grupos.map(([imovelId, docs]) => (
            <GrupoLista key={imovelId} titulo={nomeDoImovel(imovelPorId.get(imovelId))} resumo={`${docs.length} documento${docs.length === 1 ? '' : 's'}`}>
              {docs.map((d) => linha(d))}
            </GrupoLista>
          ))}
        </div>
      )}

      {folha.item && (
        <FolhaDocumento
          aberta={folha.aberto}
          aoMudar={(a) => { if (!a) folha.limpar(); }}
          doc={folha.item}
          imovel={nomeDoImovel(imovelPorId.get(folha.item.property_id))}
          tipos={tipos}
          podeEditar={podeEditar(folha.item.property_id)}
          aoAbrirArquivo={async (d) => {
            if (!(await abrirArquivo(d, linkDoArquivo))) toast({ title: 'Não foi possível abrir o arquivo', variant: 'destructive' });
          }}
          aoReler={async (d) => {
            const r = await lerComIA(d.id);
            toast(r.ok ? { title: 'Documento lido de novo' } : { title: 'A IA não conseguiu ler', description: r.erro, variant: 'destructive' });
          }}
          aoSalvar={async (d, campos) => {
            const ok = await atualizar(d.id, campos);
            toast(ok ? { title: 'Documento atualizado' } : { title: 'Não foi possível salvar', variant: 'destructive' });
            return ok;
          }}
          aoExcluir={async (d) => {
            const ok = await excluir(d);
            if (ok) folha.limpar();
            toast(ok ? { title: 'Documento excluído' } : { title: 'Não foi possível excluir', variant: 'destructive' });
          }}
        />
      )}

      <JanelaEnvio
        aberta={envioAberto}
        aoMudar={setEnvioAberto}
        imoveis={imoveisEditaveis}
        imovelInicial={imovelFiltrado !== TODOS && podeEditar(imovelFiltrado) ? imovelFiltrado : imoveisEditaveis.length === 1 ? imoveisEditaveis[0].id : ''}
        aoEnviar={enviar}
        aoConcluir={(ids, falhas) => {
          if (falhas.length) toast({ title: `${falhas.length} arquivo${falhas.length === 1 ? '' : 's'} com problema`, description: falhas.join(' '), variant: 'destructive' });
          else toast({ title: ids.length === 1 ? 'Documento salvo e lido' : `${ids.length} documentos salvos e lidos` });
          if (ids.length === 1) folha.abrir(ids[0]);
        }}
      />
    </div>
  );
};

/* ── Folha de detalhes ─────────────────────────────────────────────── */

interface FolhaDocumentoProps {
  aberta: boolean;
  aoMudar: (aberta: boolean) => void;
  doc: Documento;
  imovel: string;
  tipos: TipoDocumento[];
  podeEditar: boolean;
  aoAbrirArquivo: (d: Documento) => Promise<void>;
  aoReler: (d: Documento) => Promise<void>;
  aoSalvar: (d: Documento, campos: CamposSalvos) => Promise<boolean>;
  aoExcluir: (d: Documento) => Promise<void>;
}

const Campo = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 border-t border-gray-100 py-2 text-sm first:border-t-0">
    <span className="shrink-0 text-gray-500">{rotulo}</span>
    <span className="min-w-0 text-right font-medium text-ink [overflow-wrap:anywhere]">{children}</span>
  </div>
);

const camposDe = (d: Documento): CamposEditaveis => ({
  category: d.category,
  title: d.title,
  document_date: d.document_date,
  expires_at: d.expires_at,
  provider: d.provider,
  amount: d.amount,
  notes: d.notes,
});

const FolhaDocumento = ({ aberta, aoMudar, doc, imovel, tipos, podeEditar, aoAbrirArquivo, aoReler, aoSalvar, aoExcluir }: FolhaDocumentoProps) => {
  // Edição em andamento: volta ao recarregar a página, por documento
  const [rascunho, setRascunho] = useEstadoPersistente<CamposEditaveis | null>(`documentos.edicao.${doc.id}`, null, {
    aceita: (v) => v === null || (typeof v === 'object' && !Array.isArray(v)),
  });
  const [ocupado, setOcupado] = useState<'abrir' | 'reler' | 'salvar' | null>(null);
  const lendo = doc.ai_status === 'lendo' || doc.ai_status === 'pendente' || ocupado === 'reler';
  const validade = situacaoDaValidade(doc);
  const nomesTipos = tipos.length ? tipos.map((t) => t.name) : [doc.category];

  const fazer = async (qual: 'abrir' | 'reler' | 'salvar', acao: () => Promise<unknown>) => {
    setOcupado(qual);
    try { await acao(); } finally { setOcupado(null); }
  };

  const mudar = (campo: keyof CamposEditaveis, valor: string) =>
    setRascunho((r) => {
      const base = r ?? camposDe(doc);
      if (campo === 'amount') {
        const n = Number(valor.replace(/\./g, '').replace(',', '.'));
        return { ...base, amount: valor.trim() === '' || !Number.isFinite(n) ? null : n };
      }
      return { ...base, [campo]: valor.trim() === '' ? null : valor };
    });

  const salvar = () =>
    fazer('salvar', async () => {
      if (!rascunho) return;
      const campos = { ...rascunho, category: rascunho.category || 'Outros' };
      const mudouValidade = campos.expires_at !== doc.expires_at;
      const ok = await aoSalvar(doc, mudouValidade ? { ...campos, expires_estimated: false } : campos);
      if (ok) setRascunho(null);
    });

  const editando = rascunho !== null;
  const r = rascunho ?? camposDe(doc);

  return (
    <FolhaDetalhes
      aberta={aberta}
      aoMudar={(a) => { if (!a) setRascunho(null); aoMudar(a); }}
      titulo={doc.title || doc.file_name || 'Documento'}
      etiqueta={<Etiqueta tom="brand">{doc.category}</Etiqueta>}
      subtitulo={[imovel, doc.document_date ? formatarData(doc.document_date) : null].filter(Boolean).join(' · ')}
      largura="md"
      acoes={
        editando ? (
          <>
            <Button variant="outline" onClick={() => setRascunho(null)} disabled={ocupado === 'salvar'}>Cancelar</Button>
            <Button onClick={salvar} disabled={ocupado === 'salvar'}>{ocupado === 'salvar' ? 'Salvando…' : 'Salvar'}</Button>
          </>
        ) : (
          <>
            <Button onClick={() => fazer('abrir', () => aoAbrirArquivo(doc))} disabled={ocupado === 'abrir'} className="gap-2">
              <FolderOpen className="h-4 w-4" />Abrir arquivo
            </Button>
            {podeEditar && (
              <Button variant="outline" onClick={() => setRascunho(camposDe(doc))} className="gap-2">
                <Pencil className="h-4 w-4" />Editar
              </Button>
            )}
            {podeEditar && (
              <Button variant="outline" onClick={() => fazer('reler', () => aoReler(doc))} disabled={lendo} className="gap-2">
                <RefreshCw className={lendo ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />{lendo ? 'Lendo…' : 'Ler de novo'}
              </Button>
            )}
          </>
        )
      }
      excluir={
        podeEditar && !editando
          ? {
              rotulo: 'Excluir documento',
              titulo: 'Excluir este documento?',
              descricao: 'O arquivo e as informações lidas saem do sistema. Esta ação não pode ser desfeita.',
              aoConfirmar: () => aoExcluir(doc),
            }
          : undefined
      }
    >
      {editando ? (
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="doc-tipo">Tipo</Label>
            <Select value={r.category || 'Outros'} onValueChange={(v) => mudar('category', v)}>
              <SelectTrigger id="doc-tipo" className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[...new Set([...nomesTipos, r.category || 'Outros'])].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="doc-titulo">Título</Label>
            <Input id="doc-titulo" className="h-11" value={r.title ?? ''} onChange={(e) => mudar('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="doc-data">Data</Label>
              <Input id="doc-data" type="date" className="h-11" value={r.document_date ?? ''} onChange={(e) => mudar('document_date', e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="doc-validade">Validade</Label>
              <Input id="doc-validade" type="date" className="h-11" value={r.expires_at ?? ''} onChange={(e) => mudar('expires_at', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="doc-fornecedor">Fornecedor</Label>
              <Input id="doc-fornecedor" className="h-11" value={r.provider ?? ''} onChange={(e) => mudar('provider', e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="doc-valor">Valor (R$)</Label>
              <Input id="doc-valor" inputMode="decimal" className="h-11" value={r.amount === null || r.amount === undefined ? '' : String(r.amount).replace('.', ',')} onChange={(e) => mudar('amount', e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="doc-obs">Observação</Label>
            <Textarea id="doc-obs" rows={3} value={r.notes ?? ''} onChange={(e) => mudar('notes', e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {doc.ai_status === 'erro' && (
            <div className="flex gap-2 rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{doc.ai_error || 'A IA não conseguiu ler este documento.'} Você pode tentar de novo ou preencher em Editar.</span>
            </div>
          )}
          {lendo && (
            <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A IA está lendo o documento…
            </div>
          )}
          {doc.summary && (
            <div className="grid gap-1.5">
              <MarcaIA rotulo="Resumo da IA" className="w-fit" />
              <p className="text-sm leading-relaxed text-gray-700">{doc.summary}</p>
            </div>
          )}
          <div>
            <Campo rotulo="Tipo">{doc.category}</Campo>
            <Campo rotulo="Data">{doc.document_date ? formatarData(doc.document_date) : '—'}</Campo>
            <Campo rotulo="Validade">
              {doc.expires_at ? (
                <span className={validade?.tom === 'danger' ? 'text-danger-700' : validade?.tom === 'warning' ? 'text-warning-700' : undefined}>
                  {formatarData(doc.expires_at)}
                  {doc.expires_estimated && <span className="block text-xs font-normal text-gray-500">estimada pelo tipo de documento</span>}
                </span>
              ) : '—'}
            </Campo>
            <Campo rotulo="Fornecedor">{doc.provider || '—'}</Campo>
            <Campo rotulo="Valor">{doc.amount ? <span className="font-mono tabular-nums">{formatarMoeda(doc.amount)}</span> : '—'}</Campo>
            <Campo rotulo="Arquivo">{[doc.file_name, tamanho(doc.file_size)].filter(Boolean).join(' · ') || '—'}</Campo>
            {doc.notes && <Campo rotulo="Observação">{doc.notes}</Campo>}
          </div>
        </div>
      )}
    </FolhaDetalhes>
  );
};

/* ── Envio ─────────────────────────────────────────────────────────── */

type Situacao = 'esperando' | 'enviando' | 'pronto' | 'aviso' | 'erro';

interface JanelaEnvioProps {
  aberta: boolean;
  aoMudar: (aberta: boolean) => void;
  imoveis: Property[];
  imovelInicial: string;
  aoEnviar: (imovelId: string, arquivo: File, observacao?: string) => Promise<{ ok: boolean; erro?: string; id?: string }>;
  aoConcluir: (ids: string[], falhas: string[]) => void;
}

const JanelaEnvio = ({ aberta, aoMudar, imoveis, imovelInicial, aoEnviar, aoConcluir }: JanelaEnvioProps) => {
  const [imovel, setImovel] = useEstadoPersistente('documentos.envio.imovel', '');
  const [observacao, setObservacao] = useEstadoPersistente('documentos.envio.observacao', '');
  // Arquivo escolhido não cabe na memória do navegador: ao recarregar, escolhe de novo
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [situacoes, setSituacoes] = useState<Record<number, Situacao>>({});
  const [enviando, setEnviando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const imovelValido = imoveis.some((p) => p.id === imovel) ? imovel : imoveis.some((p) => p.id === imovelInicial) ? imovelInicial : '';

  const fechar = (limparTudo: boolean) => {
    if (enviando) return;
    if (limparTudo) {
      setArquivos([]);
      setSituacoes({});
      setObservacao('');
      setImovel('');
    }
    aoMudar(false);
  };

  const comecar = async () => {
    if (!imovelValido || !arquivos.length) return;
    setEnviando(true);
    const ids: string[] = [];
    const falhas: string[] = [];
    for (let i = 0; i < arquivos.length; i++) {
      setSituacoes((s) => ({ ...s, [i]: 'enviando' }));
      const r = await aoEnviar(imovelValido, arquivos[i], observacao);
      if (r.id) ids.push(r.id);
      if (!r.ok) falhas.push(r.erro || `${arquivos[i].name}: falhou.`);
      setSituacoes((s) => ({ ...s, [i]: !r.ok ? 'erro' : r.erro ? 'aviso' : 'pronto' }));
      if (r.ok && r.erro) falhas.push(`${arquivos[i].name}: salvo, mas a IA não leu (${r.erro})`);
    }
    setEnviando(false);
    aoConcluir(ids, falhas);
    setArquivos([]);
    setSituacoes({});
    setObservacao('');
    setImovel('');
    aoMudar(false);
  };

  const icone = (s?: Situacao) =>
    s === 'enviando' ? <Loader2 className="h-4 w-4 animate-spin text-brand" aria-label="Enviando e lendo" />
    : s === 'pronto' ? <CheckCircle2 className="h-4 w-4 text-success-600" aria-label="Pronto" />
    : s === 'aviso' ? <AlertTriangle className="h-4 w-4 text-warning-600" aria-label="Salvo sem leitura" />
    : s === 'erro' ? <XCircle className="h-4 w-4 text-danger-600" aria-label="Falhou" />
    : <FileText className="h-4 w-4 text-gray-400" aria-hidden="true" />;

  return (
    <JanelaResponsiva
      aberta={aberta}
      aoMudar={(a) => { if (!a) fechar(true); else aoMudar(true); }}
      titulo="Enviar documento"
      descricao="PDF ou foto. A IA lê, classifica e guarda as datas."
      largura="md"
      rodape={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => fechar(true)} disabled={enviando}>Cancelar</Button>
          <Button onClick={comecar} disabled={enviando || !imovelValido || !arquivos.length} className="gap-2">
            {enviando ? <><Loader2 className="h-4 w-4 animate-spin" />Lendo…</> : <><Upload className="h-4 w-4" />Enviar{arquivos.length > 1 ? ` ${arquivos.length}` : ''}</>}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="envio-imovel">Imóvel</Label>
          <Select value={imovelValido} onValueChange={setImovel} disabled={enviando}>
            <SelectTrigger id="envio-imovel" className="h-11"><SelectValue placeholder="Escolha o imóvel" /></SelectTrigger>
            <SelectContent>
              {imoveis.map((p) => <SelectItem key={p.id} value={p.id}>{nomeDoImovel(p)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Arquivos</span>
          <input
            ref={entrada}
            type="file"
            accept={TIPOS_ACEITOS}
            multiple
            className="sr-only"
            onChange={(e) => {
              const novos = Array.from(e.target.files || []);
              if (novos.length) setArquivos((a) => [...a, ...novos]);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={enviando}
            onClick={() => entrada.current?.click()}
            className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center text-sm text-gray-600 transition-colors hover:border-brand hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Upload className="h-6 w-6 text-brand" aria-hidden="true" />
            <span className="font-semibold text-ink">Escolher arquivo ou tirar foto</span>
            <span className="text-xs">PDF, JPG, PNG ou HEIC · até 15 MB cada</span>
          </button>
          {arquivos.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-xl border bg-card px-3">
              {arquivos.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2 py-2 text-sm">
                  {icone(situacoes[i])}
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 font-mono text-xs text-gray-500">{tamanho(f.size)}</span>
                  {!enviando && (
                    <button type="button" className="shrink-0 rounded-full p-1 text-gray-400 hover:text-danger-600" aria-label={`Tirar ${f.name}`} onClick={() => setArquivos((a) => a.filter((_, k) => k !== i))}>
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="envio-obs">Observação (opcional)</Label>
          <Textarea id="envio-obs" rows={2} value={observacao} disabled={enviando} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: próxima em maio, pedir à mesma empresa" />
        </div>
      </div>
    </JanelaResponsiva>
  );
};

export default DocumentosImoveis;
