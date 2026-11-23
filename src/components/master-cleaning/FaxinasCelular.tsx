/**
 * Gestão de Faxinas no celular (abaixo de 1024px), desenho `mFax` do plano (T7):
 * busca + filtro numa linha → abas Pendentes / Hoje / Concluídas / Todas
 * (abre em Pendentes) → linhas de 64px agrupadas por semana. Nas pendentes sem
 * faxineira, o botão Atribuir; nas demais, a etiqueta com a faxineira. Tocar
 * na linha abre a folha com código, endereço, valor, histórico e as ações.
 * Usa os mesmos dados e as mesmas ações da tela do computador
 * (MasterCleaningDashboard), que continua como está.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { addWeeks, format, isSameWeek, parseISO, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CheckCircle, MapPin, Search, UserCheck, Users, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AbasRolaveis from '@/components/comum/AbasRolaveis';
import GrupoLista, { ListaLinhas } from '@/components/comum/GrupoLista';
import LinhaLista from '@/components/comum/LinhaLista';
import FolhaDetalhes from '@/components/comum/FolhaDetalhes';
import BlocoRecolhivel from '@/components/comum/BlocoRecolhivel';
import { Etiqueta, EtiquetaStatus } from '@/components/comum/Etiquetas';
import { formatarData, formatarMoeda } from '@/components/comum/formatos';
import { supabase } from '@/integrations/supabase/client';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { cn } from '@/lib/utils';
import type { CleanerProfile, ReservationWithCleanerInfo } from '@/types/master-cleaning';

type Faxina = ReservationWithCleanerInfo;
type Aba = 'pendentes' | 'hoje' | 'concluidas' | 'todas';

interface FaxinasCelularProps {
  /** Faxinas do período já filtradas pela busca e pela faxineira (ordem crescente de saída) */
  faxinas: Faxina[];
  /** Faxinas sem faxineira (disponíveis), já filtradas pela busca */
  disponiveis: Faxina[];
  faxineiras: CleanerProfile[];
  /** Faxinas do período sem a busca e sem o filtro de faxineira (contagem de cada uma) */
  faxinasSemFiltro: Faxina[];
  faxineiraSelecionada: string | null;
  aoEscolherFaxineira: (id: string | null) => void;
  busca: string;
  aoBuscar: (texto: string) => void;
  /** Faxineiras de cada imóvel (cache da tela) */
  faxineirasDoImovel: Record<string, CleanerProfile[]>;
  aoCarregarFaxineiras: (imovelId: string, lista: CleanerProfile[]) => void;
  aoAtribuir: (reservaId: string, faxineiraId: string) => void;
  aoRemover: (reservaId: string) => void;
  aoAlternarConclusao: (reservaId: string) => void;
  ocupado: boolean;
}

const POR_VEZ = 30;
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const hojeISO = () => format(new Date(), 'yyyy-MM-dd');
const ehFeita = (f: Faxina) => f.cleaning_status === 'Realizada';
const hora = (h?: string | null) => (h ? h.slice(0, 5) : '');
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "Maria Silva Souza" → "Maria S." */
const nomeCurto = (nome?: string | null) => {
  const p = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return 'Faxineira';
  const inteiro = p.join(' ');
  return p.length === 1 || inteiro.length <= 14 ? inteiro : `${p[0]} ${p[p.length - 1][0]}.`;
};

/** "Hoje, 11:00", "Qua 25, 11:00" ou "Ter 1 dez, 11:00" */
const quando = (f: Faxina) => {
  const d = parseISO(f.check_out_date);
  const h = hora(f.checkout_time);
  let dia: string;
  if (f.check_out_date === hojeISO()) dia = 'Hoje';
  else {
    const mesmoMes = format(d, 'yyyy-MM') === format(new Date(), 'yyyy-MM');
    dia = `${DIAS[d.getDay()]} ${format(d, mesmoMes ? 'd' : 'd MMM', { locale: ptBR })}`;
  }
  return h ? `${dia}, ${h}` : dia;
};

/** Rótulo da semana da saída: "Esta semana", "Próxima semana", "Semana de 7 dez" */
const rotuloSemana = (inicio: Date) => {
  const agora = new Date();
  if (isSameWeek(inicio, agora, { locale: ptBR })) return 'Esta semana';
  if (isSameWeek(inicio, addWeeks(agora, 1), { locale: ptBR })) return 'Próxima semana';
  if (isSameWeek(inicio, addWeeks(agora, -1), { locale: ptBR })) return 'Semana passada';
  const mesmoAno = inicio.getFullYear() === agora.getFullYear();
  return `Semana de ${format(inicio, mesmoAno ? 'd MMM' : 'd MMM yyyy', { locale: ptBR })}`;
};

/** Agrupa (mantendo a ordem) pela semana da saída */
function porSemana(lista: Faxina[]) {
  const grupos: { chave: string; titulo: string; itens: Faxina[] }[] = [];
  for (const f of lista) {
    const inicio = startOfWeek(parseISO(f.check_out_date), { locale: ptBR });
    const chave = format(inicio, 'yyyy-MM-dd');
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.chave === chave) ultimo.itens.push(f);
    else grupos.push({ chave, titulo: rotuloSemana(inicio), itens: [f] });
  }
  return grupos;
}

const porSaida = (a: Faxina, b: Faxina) => a.check_out_date.localeCompare(b.check_out_date) || hora(a.checkout_time).localeCompare(hora(b.checkout_time));

/* ── Uma faxina numa linha ────────────────────────────── */
const LinhaFaxina = ({ f, podeAtribuir, aoAbrir, aoAtribuir }: { f: Faxina; podeAtribuir: boolean; aoAbrir: () => void; aoAtribuir: () => void }) => {
  const semFaxineira = !f.cleaner_user_id;
  const feita = ehFeita(f);
  return (
    <LinhaLista
      icone={semFaxineira && !feita ? AlertTriangle : feita ? CheckCircle : UserCheck}
      tomIcone={semFaxineira && !feita ? 'danger' : feita ? 'neutro' : 'success'}
      titulo={f.properties?.name || 'Imóvel'}
      subtitulo={[quando(f), f.guest_name].filter(Boolean).join(' · ')}
      aoTocar={aoAbrir}
      etiqueta={
        semFaxineira ? (
          feita || !podeAtribuir ? <Etiqueta tom={feita ? 'neutro' : 'danger'}>{feita ? 'Feita' : 'Sem faxineira'}</Etiqueta> : undefined
        ) : (
          <Etiqueta tom={feita ? 'neutro' : 'success'}>{nomeCurto(f.cleaner_info?.full_name)}</Etiqueta>
        )
      }
      acao={
        semFaxineira && !feita && podeAtribuir ? (
          <Button size="sm" className="h-9 rounded-full px-3.5 text-[13px] font-semibold" onClick={aoAtribuir}>
            Atribuir
          </Button>
        ) : undefined
      }
    />
  );
};

/* ── Folha com os detalhes e as ações de uma faxina ───── */
interface FolhaFaxinaProps {
  f: Faxina | null;
  historico: Faxina[];
  aoFechar: () => void;
  faxineirasDoImovel: Record<string, CleanerProfile[]>;
  aoCarregarFaxineiras: (imovelId: string, lista: CleanerProfile[]) => void;
  aoAtribuir: (reservaId: string, faxineiraId: string) => void;
  aoRemover: (reservaId: string) => void;
  aoAlternarConclusao: (reservaId: string) => void;
  ocupado: boolean;
}

const FolhaFaxina = ({ f, historico, aoFechar, faxineirasDoImovel, aoCarregarFaxineiras, aoAtribuir, aoRemover, aoAlternarConclusao, ocupado }: FolhaFaxinaProps) => {
  const { hasPermission } = useUserPermissions();
  const podeAtribuir = hasPermission('gestao_faxinas_assign');
  const podeRemover = hasPermission('gestao_faxinas_reassign');
  const podeConcluir = hasPermission('gestao_faxinas_manage');
  const [escolhida, setEscolhida] = useState('');
  const [carregando, setCarregando] = useState(false);

  const imovelId = f?.property_id;
  const precisaLista = !!f && !f.cleaner_user_id && podeAtribuir;
  const opcoes = imovelId ? faxineirasDoImovel[imovelId] : undefined;

  // Mesma busca do cartão do computador: faxineiras que este usuário pode ver no imóvel
  useEffect(() => {
    setEscolhida('');
    if (!precisaLista || !imovelId || opcoes) return;
    let ativo = true;
    setCarregando(true);
    supabase
      .rpc('fn_get_property_cleaners_for_user' as never, { p_property_id: imovelId } as never)
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (!ativo) return;
        const lista = error
          ? []
          : ((data as Array<Record<string, unknown>>) || []).map((p) => ({
              id: p.id as string,
              user_id: p.user_id as string,
              full_name: p.full_name as string,
              email: p.email as string,
              is_active: p.is_active as boolean,
              phone: p.phone as string | undefined,
            }));
        aoCarregarFaxineiras(imovelId, lista);
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f?.id, precisaLista, imovelId]);

  const feita = f ? ehFeita(f) : false;
  const endereco = f?.properties?.address;

  return (
    <FolhaDetalhes
      aberta={!!f}
      aoMudar={(v) => !v && aoFechar()}
      titulo={f?.properties?.name || 'Faxina'}
      etiqueta={f ? <EtiquetaStatus status={f.cleaning_status} /> : undefined}
      subtitulo={f ? `Saída ${quando(f)}${f.guest_name ? ` · ${f.guest_name}` : ''}` : undefined}
      acoes={
        f && f.cleaner_user_id && podeConcluir ? (
          <Button variant={feita ? 'outline' : 'default'} onClick={() => aoAlternarConclusao(f.id)} disabled={ocupado}>
            {feita ? <XCircle className="mr-1.5 h-4 w-4" /> : <CheckCircle className="mr-1.5 h-4 w-4" />}
            {feita ? 'Desmarcar como feita' : 'Marcar como feita'}
          </Button>
        ) : undefined
      }
      excluir={
        f && f.cleaner_user_id && podeRemover
          ? {
              rotulo: 'Remover faxineira',
              titulo: 'Remover a faxineira?',
              descricao: 'A faxina volta para as pendentes, sem faxineira.',
              aoConfirmar: () => {
                aoRemover(f.id);
                aoFechar();
              },
            }
          : undefined
      }
    >
      {f && (
        <>
          {precisaLista && !feita && (
            <section className="grid gap-2 rounded-2xl border border-danger-200 bg-danger-50/40 p-3.5">
              <p className="text-sm font-semibold text-danger-700">Sem faxineira</p>
              <Select value={escolhida} onValueChange={setEscolhida} disabled={carregando || (opcoes?.length ?? 0) === 0}>
                <SelectTrigger className="h-11 bg-background">
                  <SelectValue
                    placeholder={carregando ? 'Carregando faxineiras…' : (opcoes?.length ?? 0) === 0 ? 'Nenhuma faxineira neste imóvel' : 'Escolher faxineira'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(opcoes || []).map((c) => (
                    <SelectItem key={c.user_id} value={c.user_id}>
                      {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="min-h-11"
                disabled={!escolhida || ocupado}
                onClick={() => {
                  aoAtribuir(f.id, escolhida);
                  aoFechar();
                }}
              >
                <UserCheck className="mr-1.5 h-4 w-4" />
                Atribuir
              </Button>
            </section>
          )}

          {endereco ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800"
            >
              <MapPin className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <span className="min-w-0 flex-1">{endereco}</span>
              <span className="text-xs font-semibold text-brand">Mapa</span>
            </a>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-gray-50 p-3.5">
            <div className="min-w-0">
              <dt className="text-xs text-gray-500">Código</dt>
              <dd className="truncate font-mono text-sm font-semibold text-gray-900">{f.reservation_code}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-gray-500">Valor da faxina</dt>
              <dd className="truncate font-mono text-sm font-semibold tabular-nums text-gray-900">{f.cleaning_fee != null ? formatarMoeda(f.cleaning_fee) : '—'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-gray-500">Faxineira</dt>
              <dd className="truncate text-sm font-semibold text-gray-900">{f.cleaner_info?.full_name || 'Sem faxineira'}</dd>
              {f.cleaner_info?.phone && <dd className="truncate text-xs text-gray-500">{f.cleaner_info.phone}</dd>}
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-gray-500">Próxima entrada</dt>
              <dd className="truncate text-sm font-semibold text-gray-900">
                {f.next_check_in_date ? `${formatarData(f.next_check_in_date, true)}${f.next_checkin_time ? ` às ${hora(f.next_checkin_time)}` : ''}` : '—'}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-gray-500">Reserva</dt>
              <dd className="truncate text-sm font-semibold text-gray-900">{f.reservation_status}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-gray-500">Pagamento da faxina</dt>
              <dd className="truncate text-sm font-semibold text-gray-900">{f.cleaning_payment_status || '—'}</dd>
            </div>
          </dl>

          <section>
            <h3 className="mb-1 font-display text-sm font-bold text-gray-900">Histórico do imóvel</h3>
            {historico.length === 0 ? (
              <p className="text-xs text-gray-500">Nenhuma outra faxina deste imóvel no período.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {historico.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-gray-700">
                      {formatarData(h.check_out_date, true)} · {h.cleaner_info?.full_name || 'Sem faxineira'}
                    </span>
                    <EtiquetaStatus status={h.cleaning_status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </FolhaDetalhes>
  );
};

/* ── Filtro por faxineira, com a contagem de cada uma ─── */
const FolhaFaxineiras = ({
  aberta,
  aoMudar,
  faxineiras,
  faxinas,
  selecionada,
  aoEscolher,
}: {
  aberta: boolean;
  aoMudar: (v: boolean) => void;
  faxineiras: CleanerProfile[];
  faxinas: Faxina[];
  selecionada: string | null;
  aoEscolher: (id: string | null) => void;
}) => {
  const contagem = useMemo(() => {
    const m: Record<string, { pend: number; feitas: number }> = {};
    for (const f of faxinas) {
      if (!f.cleaner_user_id) continue;
      m[f.cleaner_user_id] ??= { pend: 0, feitas: 0 };
      if (ehFeita(f)) m[f.cleaner_user_id].feitas++;
      else m[f.cleaner_user_id].pend++;
    }
    return m;
  }, [faxinas]);
  const escolher = (id: string | null) => {
    aoEscolher(id);
    aoMudar(false);
  };
  return (
    <FolhaDetalhes aberta={aberta} aoMudar={aoMudar} titulo="Filtrar por faxineira" subtitulo="Faxinas do período em cada uma">
      <ListaLinhas>
        <LinhaLista icone={Users} tomIcone="brand" titulo="Todas as faxineiras" aoTocar={() => escolher(null)} etiqueta={!selecionada ? <Etiqueta tom="brand">Atual</Etiqueta> : undefined} />
        {faxineiras.map((c) => {
          const n = contagem[c.user_id] ?? { pend: 0, feitas: 0 };
          return (
            <LinhaLista
              key={c.user_id}
              icone={UserCheck}
              tomIcone="success"
              titulo={c.full_name}
              subtitulo={`${plural(n.pend, 'pendente', 'pendentes')} · ${plural(n.feitas, 'feita', 'feitas')}`}
              aoTocar={() => escolher(c.user_id)}
              etiqueta={selecionada === c.user_id ? <Etiqueta tom="brand">Atual</Etiqueta> : undefined}
            />
          );
        })}
      </ListaLinhas>
    </FolhaDetalhes>
  );
};

/* ── Lista agrupada por semana, 30 por vez ────────────── */
const ListaPorSemana = ({
  itens,
  vazio,
  podeAtribuir,
  aoAbrir,
}: {
  itens: Faxina[];
  vazio: string;
  podeAtribuir: boolean;
  aoAbrir: (f: Faxina) => void;
}) => {
  const [limite, setLimite] = useState(POR_VEZ);
  useEffect(() => setLimite(POR_VEZ), [itens.length]);
  const grupos = useMemo(() => porSemana(itens.slice(0, limite)), [itens, limite]);
  // Contagem de cada semana com a lista inteira (não só o pedaço mostrado)
  const totalDaSemana = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of itens) {
      const k = format(startOfWeek(parseISO(f.check_out_date), { locale: ptBR }), 'yyyy-MM-dd');
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }, [itens]);

  if (itens.length === 0) {
    return <p className="rounded-2xl border bg-card px-4 py-8 text-center text-sm text-gray-500">{vazio}</p>;
  }
  const faltam = itens.length - limite;
  return (
    <>
      {grupos.map((g) => (
        <GrupoLista key={g.chave} titulo={<span className="normal-case">{g.titulo}</span>} resumo={plural(totalDaSemana[g.chave] ?? g.itens.length, 'faxina', 'faxinas')}>
          {g.itens.map((f) => (
            <LinhaFaxina key={f.id} f={f} podeAtribuir={podeAtribuir} aoAbrir={() => aoAbrir(f)} aoAtribuir={() => aoAbrir(f)} />
          ))}
        </GrupoLista>
      ))}
      {faltam > 0 && (
        <Button variant="outline" className="min-h-11 rounded-full" onClick={() => setLimite((l) => l + POR_VEZ)}>
          Mostrar mais {Math.min(POR_VEZ, faltam)} de {faltam}
        </Button>
      )}
    </>
  );
};

const FaxinasCelular = (p: FaxinasCelularProps) => {
  const { hasPermission } = useUserPermissions();
  const podeAtribuir = hasPermission('gestao_faxinas_assign');
  const [aba, setAba] = useState<Aba>('pendentes');
  const [selId, setSelId] = useState<string | null>(null);
  const [filtroAberto, setFiltroAberto] = useState(false);

  // Todas as faxinas da tela: as do período + as disponíveis que ainda não vieram
  const todas = useMemo(() => {
    const ids = new Set(p.faxinas.map((f) => f.id));
    const extras = p.faxineiraSelecionada ? [] : p.disponiveis.filter((f) => !ids.has(f.id));
    return [...p.faxinas, ...extras].sort(porSaida);
  }, [p.faxinas, p.disponiveis, p.faxineiraSelecionada]);

  const hoje = hojeISO();
  const listas = useMemo(() => {
    const abertas = todas.filter((f) => !ehFeita(f));
    return {
      proximas: abertas.filter((f) => f.check_out_date >= hoje),
      // Saídas que já passaram e a faxina não foi marcada como feita (mais recentes primeiro)
      atrasadas: abertas.filter((f) => f.check_out_date < hoje).reverse(),
      abertas,
      hoje: todas.filter((f) => f.check_out_date === hoje),
      feitas: todas.filter(ehFeita).reverse(),
    };
  }, [todas, hoje]);

  const sel = selId ? todas.find((f) => f.id === selId) ?? null : null;
  const historico = useMemo(
    () => (sel ? todas.filter((f) => f.property_id === sel.property_id && f.id !== sel.id && f.check_out_date <= sel.check_out_date).slice(-3).reverse() : []),
    [sel, todas],
  );
  const abrir = (f: Faxina) => setSelId(f.id);
  const nomeFiltro = p.faxineiraSelecionada ? p.faxineiras.find((c) => c.user_id === p.faxineiraSelecionada)?.full_name : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      {/* Busca + filtro numa linha */}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <Input
            type="search"
            value={p.busca}
            onChange={(e) => p.aoBuscar(e.target.value)}
            placeholder="Imóvel, código ou hóspede"
            aria-label="Buscar faxinas"
            className="h-11 rounded-full bg-card pl-10 text-sm"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setFiltroAberto(true)}
          aria-label={nomeFiltro ? `Filtrar por faxineira (atual: ${nomeFiltro})` : 'Filtrar por faxineira'}
          className={cn('relative h-11 w-11 shrink-0 rounded-full', nomeFiltro && 'border-brand text-brand')}
        >
          <Users className="h-[18px] w-[18px]" />
          {nomeFiltro && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand" aria-hidden="true" />}
        </Button>
      </div>
      {nomeFiltro && (
        <button type="button" onClick={() => p.aoEscolherFaxineira(null)} className="-mt-1 self-start text-xs font-semibold text-brand-600">
          Só {nomeFiltro} · limpar filtro
        </button>
      )}

      <AbasRolaveis
        rotulo="Faxinas"
        sangrar
        valor={aba}
        aoMudar={(v) => setAba(v as Aba)}
        itens={[
          { valor: 'pendentes', rotulo: 'Pendentes', contagem: listas.abertas.length },
          { valor: 'hoje', rotulo: 'Hoje', contagem: listas.hoje.length },
          { valor: 'concluidas', rotulo: 'Concluídas', contagem: listas.feitas.length },
          { valor: 'todas', rotulo: 'Todas', contagem: todas.length },
        ]}
      />

      {aba === 'pendentes' && (
        <>
          {listas.atrasadas.length > 0 && (
            <BlocoRecolhivel
              titulo="Atrasadas"
              resumo={`${plural(listas.atrasadas.length, 'saída já passou', 'saídas já passaram')} sem a faxina marcada como feita`}
              etiqueta={<Etiqueta tom="danger">{listas.atrasadas.length}</Etiqueta>}
            >
              <ListaLinhas>
                {listas.atrasadas.slice(0, POR_VEZ).map((f) => (
                  <LinhaFaxina key={f.id} f={f} podeAtribuir={podeAtribuir} aoAbrir={() => abrir(f)} aoAtribuir={() => abrir(f)} />
                ))}
              </ListaLinhas>
              {listas.atrasadas.length > POR_VEZ && (
                <p className="pt-2 text-center text-xs text-gray-500">Mostrando as {POR_VEZ} mais recentes. Use a aba Todas para ver o resto.</p>
              )}
            </BlocoRecolhivel>
          )}
          <ListaPorSemana itens={listas.proximas} vazio="Nenhuma faxina pendente daqui para a frente." podeAtribuir={podeAtribuir} aoAbrir={abrir} />
        </>
      )}
      {aba === 'hoje' && <ListaPorSemana itens={listas.hoje} vazio="Nenhuma saída hoje." podeAtribuir={podeAtribuir} aoAbrir={abrir} />}
      {aba === 'concluidas' && <ListaPorSemana itens={listas.feitas} vazio="Nenhuma faxina concluída no período." podeAtribuir={podeAtribuir} aoAbrir={abrir} />}
      {aba === 'todas' && <ListaPorSemana itens={todas} vazio="Nenhuma faxina encontrada." podeAtribuir={podeAtribuir} aoAbrir={abrir} />}

      <FolhaFaxina
        f={sel}
        historico={historico}
        aoFechar={() => setSelId(null)}
        faxineirasDoImovel={p.faxineirasDoImovel}
        aoCarregarFaxineiras={p.aoCarregarFaxineiras}
        aoAtribuir={p.aoAtribuir}
        aoRemover={p.aoRemover}
        aoAlternarConclusao={p.aoAlternarConclusao}
        ocupado={p.ocupado}
      />
      <FolhaFaxineiras
        aberta={filtroAberto}
        aoMudar={setFiltroAberto}
        faxineiras={p.faxineiras}
        faxinas={p.faxinasSemFiltro}
        selecionada={p.faxineiraSelecionada}
        aoEscolher={p.aoEscolherFaxineira}
      />
    </div>
  );
};

export default FaxinasCelular;
