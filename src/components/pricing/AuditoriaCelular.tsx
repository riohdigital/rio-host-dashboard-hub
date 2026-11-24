/**
 * Aba Auditoria da Precificação no celular (abaixo de 1024px), no mesmo
 * padrão das Reservas: faixa de resumo → busca + filtro → uma linha por
 * reserva, agrupadas por mês de entrada, 30 por vez → tocar abre a folha com
 * tudo o que o cartão grande mostrava (sistema × portal, notas, ações).
 *
 * Só apresentação: as reservas, a ação de auditar e os links chegam prontos
 * do ReservationsAuditTab; a leitura do que veio do portal está em auditoria.ts.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, LayoutDashboard, RefreshCw, ShieldCheck, SlidersHorizontal, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BarraBusca, { BotaoBarra } from '@/components/comum/BarraBusca';
import Escolhas from '@/components/comum/Escolhas';
import EstadoVazio from '@/components/comum/EstadoVazio';
import { Etiqueta, EtiquetaPlataforma } from '@/components/comum/Etiquetas';
import FaixaResumo from '@/components/comum/FaixaResumo';
import FolhaDetalhes from '@/components/comum/FolhaDetalhes';
import GrupoLista from '@/components/comum/GrupoLista';
import LinhaLista from '@/components/comum/LinhaLista';
import MarcaIA from '@/components/comum/MarcaIA';
import { TEXTO_DO_TOM, type Tom } from '@/components/comum/cores';
import { formatarMoeda, formatarMoedaSemCentavos } from '@/components/comum/formatos';
import { noites, nomeDoMes, periodoCurto } from '@/components/reservations/datas';
import { cn } from '@/lib/utils';
import {
  ROTULO_DO_RESULTADO,
  TOM_DO_RESULTADO,
  diferencaDeReceita,
  temDiferenca,
  lerConferencia,
  mesmoPeriodo,
  resultadoDaAuditoria,
  semAcento,
  type ConferenciaPortal,
  type ResultadoAuditoria,
} from './auditoria';
import type { ReservaAuditada } from './ReservationsAuditTab';

const POR_VEZ = 30;

type Filtro = 'todas' | ResultadoAuditoria;
const ORDEM_DO_FILTRO: ResultadoAuditoria[] = ['conferida', 'diferenca', 'pendente', 'nao_concluida'];
const PLURAL_DO_RESULTADO: Record<ResultadoAuditoria, string> = {
  conferida: 'Conferidas',
  diferenca: 'Com diferença',
  pendente: 'Pendentes',
  nao_concluida: 'Não concluídas',
};

interface AuditoriaCelularProps {
  /** As reservas que a aba carregou (as mais recentes do filtro) */
  reservas: ReservaAuditada[];
  carregando: boolean;
  /** Quantas reservas a aba carrega no máximo (vai para o texto de ajuda) */
  limite: number;
  /** Reservas com auditoria em andamento, por id */
  auditando: Record<string, boolean>;
  aoAuditar: (reserva: ReservaAuditada) => void;
  nomeDoImovel: (reserva: ReservaAuditada) => string;
  /** Página da reserva no portal da plataforma, quando existe */
  linkDoPortal: (reserva: ReservaAuditada) => string | null;
  /** Página de repasses da plataforma, quando existe */
  linkDosRepasses: (reserva: ReservaAuditada) => string | null;
}

interface Leitura {
  reserva: ReservaAuditada;
  resultado: ResultadoAuditoria;
  conferencia: ConferenciaPortal | null;
  /** Portal − sistema, quando dá para comparar */
  diferenca: number | null;
}

const textoDasNoites = (r: ReservaAuditada) => {
  const n = noites(r.check_in_date, r.check_out_date);
  return n > 0 ? `${n} ${n === 1 ? 'noite' : 'noites'}` : '';
};

const comSinal = (valor: number) => `${valor > 0 ? '+' : valor < 0 ? '−' : ''}${formatarMoeda(Math.abs(valor))}`;

/* ── Folha: sistema × portal ─────────────────────────────── */

const Secao = ({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) => (
  <section className="grid min-w-0 gap-1.5">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-xs font-semibold text-gray-500">{titulo}</h3>
      {extra}
    </div>
    {children}
  </section>
);

const Comparacao = ({ leitura }: { leitura: Leitura }) => {
  const { reserva, conferencia, diferenca } = leitura;
  const comparavel = mesmoPeriodo(reserva, conferencia);
  const linhas: { rotulo: string; sistema: React.ReactNode; portal: React.ReactNode; tom?: Tom; texto?: boolean }[] = [
    {
      rotulo: 'Datas',
      texto: true,
      sistema: periodoCurto(reserva.check_in_date, reserva.check_out_date),
      portal: conferencia?.entrada && conferencia.saida ? periodoCurto(conferencia.entrada, conferencia.saida) : '—',
    },
    {
      rotulo: 'Receita',
      sistema: formatarMoeda(Number(reserva.total_revenue)),
      portal: conferencia?.receita !== undefined ? formatarMoeda(conferencia.receita) : '—',
    },
  ];
  if (temDiferenca(diferenca)) linhas.push({ rotulo: 'Diferença', sistema: '', portal: comSinal(diferenca as number), tom: 'warning' });
  else if (diferenca) linhas.push({ rotulo: 'Diferença (dentro da tolerância de R$ 1)', sistema: '', portal: comSinal(diferenca) });
  if (Number(reserva.cleaning_fee) > 0 || conferencia?.limpeza !== undefined) {
    linhas.push({
      rotulo: 'Limpeza',
      sistema: formatarMoeda(Number(reserva.cleaning_fee)),
      portal: conferencia?.limpeza !== undefined ? formatarMoeda(conferencia.limpeza) : '—',
    });
  }

  // O que só o portal informa
  const doPortal = conferencia
    ? [
        { rotulo: 'Valor comissionável', valor: conferencia.comissionavel },
        { rotulo: 'Comissão', valor: conferencia.comissao },
        { rotulo: 'Total bruto', valor: conferencia.bruto },
        { rotulo: 'Repasse ao anfitrião', valor: conferencia.repasse },
        { rotulo: 'Coanfitrião', valor: conferencia.coanfitriao },
        { rotulo: 'Pago pelo hóspede', valor: conferencia.pagoPeloHospede },
      ].filter((item): item is { rotulo: string; valor: number } => item.valor !== undefined)
    : [];

  return (
    <Secao titulo="Sistema × portal">
      <div className="rounded-2xl border px-3.5 py-1">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="text-xs text-gray-500">
              <th scope="col" className="w-[26%] py-2 text-left font-normal">
                <span className="sr-only">Campo</span>
              </th>
              <th scope="col" className="py-2 text-right font-normal">Sistema</th>
              <th scope="col" className="py-2 text-right font-normal">Portal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 border-t border-gray-100">
            {linhas.map((l) => (
              <tr key={l.rotulo}>
                <th scope="row" className="py-2.5 pr-2 text-left text-xs font-normal text-gray-500">{l.rotulo}</th>
                <td className={cn('truncate py-2.5 pl-2 text-right text-gray-900', l.texto ? 'text-xs' : 'font-mono tabular-nums')}>{l.sistema}</td>
                <td className={cn('truncate py-2.5 pl-2 text-right', l.texto ? 'text-xs' : 'font-mono font-semibold tabular-nums', TEXTO_DO_TOM[l.tom ?? 'neutro'])}>{l.portal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {conferencia && !comparavel && conferencia.entrada && (
        <p className="text-xs text-gray-500">
          O portal mostra a estadia inteira
          {conferencia.parcelas > 1 ? `, dividida em ${conferencia.parcelas} parcelas` : ''}; esta linha é uma parte dela, por isso os valores não são comparados.
        </p>
      )}
      {!conferencia && <p className="text-xs text-gray-500">Ainda sem valores vistos no portal para esta reserva.</p>}
      {doPortal.length > 0 && (
        <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-2.5">
          {doPortal.map((item) => (
            <div key={item.rotulo} className="min-w-0">
              <dt className="truncate text-xs text-gray-500">{item.rotulo}</dt>
              <dd className="truncate font-mono text-sm tabular-nums text-gray-900">{formatarMoeda(item.valor)}</dd>
            </div>
          ))}
        </dl>
      )}
    </Secao>
  );
};

/* ── Aba ─────────────────────────────────────────────────── */

const AuditoriaCelular = ({ reservas, carregando, limite, auditando, aoAuditar, nomeDoImovel, linkDoPortal, linkDosRepasses }: AuditoriaCelularProps) => {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [quantas, setQuantas] = useState(POR_VEZ);
  const [abertaId, setAbertaId] = useState<string | null>(null);

  // Volta para as 30 primeiras quando a lista muda de recorte
  useEffect(() => setQuantas(POR_VEZ), [busca, filtro]);

  // Entrada mais recente primeiro, para os meses ficarem em blocos
  const leituras = useMemo<Leitura[]>(
    () =>
      [...reservas]
        .sort((a, b) => (b.check_in_date || '').localeCompare(a.check_in_date || '') || (a.reservation_code || '').localeCompare(b.reservation_code || ''))
        .map((reserva) => {
          const conferencia = lerConferencia(reserva.platform_verified_data);
          return { reserva, conferencia, resultado: resultadoDaAuditoria(reserva), diferenca: diferencaDeReceita(reserva, conferencia) };
        }),
    [reservas],
  );

  const contagens = useMemo(() => {
    const c: Record<ResultadoAuditoria, number> = { conferida: 0, diferenca: 0, pendente: 0, nao_concluida: 0 };
    leituras.forEach((l) => (c[l.resultado] += 1));
    return c;
  }, [leituras]);

  const filtradas = useMemo(() => {
    const termo = semAcento(busca.trim());
    return leituras.filter((l) => {
      // "Conferidas" inclui as que têm diferença (o mesmo número da faixa)
      if (filtro === 'conferida' && !l.reserva.is_verified_by_ai) return false;
      if (filtro !== 'todas' && filtro !== 'conferida' && l.resultado !== filtro) return false;
      if (!termo) return true;
      const r = l.reserva;
      return semAcento(`${r.guest_name || ''} ${r.reservation_code || ''} ${nomeDoImovel(r)}`).includes(termo);
    });
  }, [leituras, busca, filtro, nomeDoImovel]);

  // Contagem de cada mês sobre a lista inteira (não só as já carregadas)
  const porMes = useMemo(() => {
    const m = new Map<string, { n: number; verificadas: number }>();
    filtradas.forEach((l) => {
      const chave = (l.reserva.check_in_date || '').slice(0, 7);
      const s = m.get(chave) ?? { n: 0, verificadas: 0 };
      s.n += 1;
      if (l.reserva.is_verified_by_ai) s.verificadas += 1;
      m.set(chave, s);
    });
    return m;
  }, [filtradas]);

  const grupos = useMemo(() => {
    const lista: { chave: string; itens: Leitura[] }[] = [];
    filtradas.slice(0, quantas).forEach((l) => {
      const chave = (l.reserva.check_in_date || '').slice(0, 7);
      const ultimo = lista[lista.length - 1];
      if (ultimo && ultimo.chave === chave) ultimo.itens.push(l);
      else lista.push({ chave, itens: [l] });
    });
    return lista;
  }, [filtradas, quantas]);

  const verificadas = contagens.conferida + contagens.diferenca;
  const restantes = filtradas.length - quantas;
  const aberta = abertaId ? leituras.find((l) => l.reserva.id === abertaId) ?? null : null;

  const opcoesDoFiltro = [
    { valor: 'todas', rotulo: 'Todas', contagem: leituras.length },
    ...ORDEM_DO_FILTRO.map((r) => ({ valor: r, rotulo: PLURAL_DO_RESULTADO[r], contagem: r === 'conferida' ? verificadas : contagens[r] })),
  ];

  const folha = () => {
    if (!aberta) return null;
    const { reserva: r, resultado, conferencia } = aberta;
    const emAndamento = !!auditando[r.id];
    const portal = linkDoPortal(r);
    const repasses = linkDosRepasses(r);
    const origem = [conferencia?.fonte, conferencia?.conferidoPor && `por ${conferencia.conferidoPor}`].filter(Boolean).join(' · ');
    return (
      <>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Etiqueta tom={emAndamento ? 'brand' : TOM_DO_RESULTADO[resultado]}>{emAndamento ? 'Auditando no portal…' : ROTULO_DO_RESULTADO[resultado]}</Etiqueta>
          {r.is_verified_by_ai && <MarcaIA />}
          {r.verified_at && <span className="text-xs text-gray-500">em {new Date(r.verified_at).toLocaleDateString('pt-BR')}</span>}
        </div>

        <Comparacao leitura={aberta} />

        {Number(r.net_revenue) > 0 && (
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-xs text-gray-500">Receita líquida estimada</span>
            <span className="font-mono font-semibold tabular-nums text-success-700">{formatarMoeda(Number(r.net_revenue))}</span>
          </div>
        )}

        <Secao titulo="Notas da verificação">
          <p className="whitespace-pre-line break-words text-sm text-gray-700">{r.verification_notes || 'Nenhuma nota registrada até o momento.'}</p>
        </Secao>

        {conferencia && conferencia.apontamentos.length > 0 && (
          <Secao titulo="Apontamentos da auditoria" extra={<MarcaIA />}>
            <ul className="grid list-disc gap-1 pl-4 text-sm text-gray-700">
              {conferencia.apontamentos.map((a, i) => (
                <li key={i} className="break-words">{a}</li>
              ))}
            </ul>
          </Secao>
        )}

        {origem && <p className="break-words text-xs text-gray-500">Fonte: {origem}</p>}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-2 [&>*]:min-h-11 [&>*]:w-full">
          <Button type="button" onClick={() => aoAuditar(r)} disabled={emAndamento} className="col-span-full gap-1.5 rounded-full">
            <RefreshCw className={cn('h-4 w-4', emAndamento && 'animate-spin')} aria-hidden="true" />
            {emAndamento ? 'Auditando…' : r.is_verified_by_ai ? 'Reconferir no portal' : 'Auditar com IA'}
          </Button>
          <Button asChild variant="outline" className="gap-1.5 rounded-full px-3">
            <Link to={`/reservas?search=${encodeURIComponent(r.reservation_code)}`}>
              <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
              Reserva
            </Link>
          </Button>
          {portal && (
            <Button asChild variant="outline" className="gap-1.5 rounded-full px-3">
              <a href={portal} target="_blank" rel="noopener noreferrer" aria-label={`Abrir a reserva no portal ${r.platform}`}>
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                Portal
              </a>
            </Button>
          )}
          {repasses && (
            <Button asChild variant="outline" className="gap-1.5 rounded-full px-3">
              <a href={repasses} target="_blank" rel="noopener noreferrer" aria-label={`Abrir os repasses no portal ${r.platform}`}>
                <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
                Repasses
              </a>
            </Button>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <FaixaResumo
        rotulo="Conferidas no portal"
        valor={`${verificadas} de ${leituras.length}`}
        ajuda={
          <>
            <p>Conferência no portal da plataforma, com o login salvo do anfitrião. A lista traz as {limite} reservas lançadas mais recentemente nos imóveis e no período do filtro.</p>
            <p className="mt-2">
              <strong>Com diferença</strong>: o valor visto no portal difere do sistema em mais de R$ 1,00 (até R$ 1,00 é arredondamento e conta como conferida). <strong>Não concluída</strong>: a auditoria tentou e não conseguiu (sem login ou erro).
            </p>
          </>
        }
        apoio={[
          { rotulo: 'Pendentes', valor: contagens.pendente, tom: contagens.pendente > 0 ? 'warning' : 'neutro' },
          { rotulo: 'Com diferença', valor: contagens.diferenca, tom: contagens.diferenca > 0 ? 'warning' : 'neutro' },
          { rotulo: 'Não concluídas', valor: contagens.nao_concluida, tom: contagens.nao_concluida > 0 ? 'danger' : 'neutro' },
        ]}
      />

      <BarraBusca valor={busca} aoMudar={setBusca} placeholder="Buscar hóspede" rotulo="Buscar por hóspede, código ou imóvel">
        <BotaoBarra icone={SlidersHorizontal} rotulo="Filtros" contagem={filtro !== 'todas' ? 1 : 0} aoClicar={() => setFiltrosAbertos(true)} />
      </BarraBusca>

      {carregando ? (
        <p className="rounded-2xl border bg-card px-3.5 py-6 text-center text-sm text-gray-500">Carregando auditorias…</p>
      ) : leituras.length === 0 ? (
        <EstadoVazio icone={ShieldCheck} titulo="Nenhuma reserva para auditar" descricao="Ajuste os imóveis ou o período no filtro do topo." />
      ) : filtradas.length === 0 ? (
        <EstadoVazio icone={ShieldCheck} titulo="Nenhuma reserva aqui" descricao="Ajuste a busca ou o filtro." />
      ) : (
        <>
          {grupos.map((g) => {
            const s = porMes.get(g.chave);
            return (
              <GrupoLista
                key={g.chave}
                titulo={nomeDoMes(g.chave)}
                resumo={
                  !s
                    ? undefined
                    : filtro === 'todas'
                      ? `${s.verificadas} de ${s.n} ${s.verificadas === 1 ? 'conferida' : 'conferidas'}`
                      : `${s.n} ${s.n === 1 ? 'reserva' : 'reservas'}`
                }
              >
                {g.itens.map((l) => {
                  const r = l.reserva;
                  const emAndamento = !!auditando[r.id];
                  return (
                    <LinhaLista
                      key={r.id}
                      className="min-h-[76px]"
                      canal={r.platform}
                      titulo={r.guest_name || 'Hóspede sem nome'}
                      subtitulo={`${nomeDoImovel(r)} · ${periodoCurto(r.check_in_date, r.check_out_date)}`}
                      valor={formatarMoedaSemCentavos(Number(r.total_revenue))}
                      legenda={
                        emAndamento
                          ? 'Auditando…'
                          : l.resultado === 'diferenca' && l.diferenca !== null
                            ? `Difere ${formatarMoeda(Math.abs(l.diferenca))}`
                            : ROTULO_DO_RESULTADO[l.resultado]
                      }
                      tomLegenda={emAndamento ? 'brand' : TOM_DO_RESULTADO[l.resultado]}
                      aoTocar={() => setAbertaId(r.id)}
                    />
                  );
                })}
              </GrupoLista>
            );
          })}
          {restantes > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuantas((q) => q + POR_VEZ)}
              className="min-h-11 w-full rounded-full text-[13px] font-semibold"
            >
              Carregar mais {Math.min(POR_VEZ, restantes)}
              <span className="ml-1 font-mono text-xs font-normal tabular-nums text-gray-500">
                ({quantas} de {filtradas.length})
              </span>
            </Button>
          )}
        </>
      )}

      <FolhaDetalhes
        aberta={!!aberta}
        aoMudar={(v) => !v && setAbertaId(null)}
        titulo={aberta ? aberta.reserva.guest_name || 'Hóspede sem nome' : ''}
        etiqueta={aberta ? <EtiquetaPlataforma plataforma={aberta.reserva.platform} /> : undefined}
        subtitulo={
          aberta
            ? [
                nomeDoImovel(aberta.reserva),
                periodoCurto(aberta.reserva.check_in_date, aberta.reserva.check_out_date),
                textoDasNoites(aberta.reserva),
                aberta.reserva.reservation_code,
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
      >
        {folha()}
      </FolhaDetalhes>

      <FolhaDetalhes
        aberta={filtrosAbertos}
        aoMudar={setFiltrosAbertos}
        titulo="Filtros"
        subtitulo="O período e os imóveis ficam no filtro do topo."
        acoes={
          <>
            <Button type="button" variant="outline" className="rounded-full" disabled={filtro === 'todas'} onClick={() => setFiltro('todas')}>
              Limpar
            </Button>
            <Button type="button" className="rounded-full" onClick={() => setFiltrosAbertos(false)}>
              Ver {filtradas.length} {filtradas.length === 1 ? 'reserva' : 'reservas'}
            </Button>
          </>
        }
      >
        <Escolhas rotulo="Resultado da auditoria" opcoes={opcoesDoFiltro} valor={filtro} aoMudar={(v) => setFiltro(v as Filtro)} />
      </FolhaDetalhes>
    </div>
  );
};

export default AuditoriaCelular;
