/**
 * Visão Imóveis do Calendário (era "Linha do tempo"): uma linha por imóvel e
 * 14 dias na tela, começando no 1º dia do período do filtro global. As setas
 * andam 14 dias sem sair do período. Cada reserva é uma barra na cor do canal
 * com o primeiro nome do hóspede. O cabeçalho das datas fica grudado no topo
 * ao rolar a página (não há rolagem de lado: os 14 dias cabem na largura).
 * Tocar no nome do imóvel abre o mês só dele (MesDoImovel).
 */
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { corDoCanal } from '@/components/comum/cores';
import { noites, somarDias } from '@/components/pricing/ocupacao';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CalendarReservation } from '@/types/calendar';
import { Property } from '@/types/property';
import MesDoImovel from './MesDoImovel';
import {
  DIAS_POR_JANELA,
  MesDoPeriodo,
  SEMANA_CURTA,
  TOPO_GRUDENTO,
  diaDaSemana,
  janelaQueContem,
  primeiroNome,
  rotuloDia,
  rotuloIntervalo,
} from './periodo';

interface Props {
  inicio: string;
  fim: string;
  meses: MesDoPeriodo[];
  imoveis: Property[];
  reservas: CalendarReservation[];
  hoje: string;
  aoTocarReserva: (r: CalendarReservation) => void;
}

/** Coluna dos imóveis e as 14 colunas de dias */
const COLUNAS = 'grid grid-cols-[86px_repeat(14,minmax(0,1fr))] lg:grid-cols-[12rem_repeat(14,minmax(0,1fr))]';

const VisaoImoveis = ({ inicio, fim, meses, imoveis, reservas, hoje, aoTocarReserva }: Props) => {
  const [janela, setJanela] = useState(inicio);
  const [imovelAberto, setImovelAberto] = useState<string | null>(null);

  const dias = useMemo(() => Array.from({ length: DIAS_POR_JANELA }, (_, i) => somarDias(janela, i)), [janela]);
  const fimJanela = dias[dias.length - 1];
  const fimVisivel = fimJanela > fim ? fim : fimJanela;
  const contemHoje = hoje >= inicio && hoje <= fim;

  const porImovel = useMemo(() => {
    const mapa = new Map<string, CalendarReservation[]>();
    for (const r of reservas) {
      if (r.reservation_status === 'Cancelada') continue;
      const lista = mapa.get(r.property_id) || [];
      lista.push(r);
      mapa.set(r.property_id, lista);
    }
    return mapa;
  }, [reservas]);

  const canais = useMemo(() => [...new Set(reservas.filter((r) => r.reservation_status !== 'Cancelada').map((r) => r.platform || 'Outro'))], [reservas]);

  const aberto = imovelAberto ? imoveis.find((p) => p.id === imovelAberto) : undefined;
  if (aberto) {
    const idx = Math.max(0, meses.findIndex((m) => janela >= m.primeiroDia && janela <= m.ultimoDia));
    return (
      <MesDoImovel
        imovel={aberto}
        reservas={porImovel.get(aberto.id) || []}
        meses={meses}
        mesInicial={idx}
        hoje={hoje}
        aoVoltar={() => setImovelAberto(null)}
        aoTocarReserva={aoTocarReserva}
      />
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          onClick={() => setJanela((j) => somarDias(j, -DIAS_POR_JANELA))}
          disabled={janela <= inicio}
          aria-label="14 dias antes"
        >
          <ChevronLeft className="h-[18px] w-[18px]" />
        </Button>
        <p className="min-w-0 flex-1 truncate text-center font-display text-base font-bold text-gray-900" aria-live="polite">
          {rotuloIntervalo(janela, fimVisivel)}
        </p>
        {contemHoje && (hoje < janela || hoje > fimJanela) && (
          <Button variant="outline" size="sm" className="h-10 shrink-0 rounded-full px-3" onClick={() => setJanela(janelaQueContem(inicio, hoje))}>
            Hoje
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          onClick={() => setJanela((j) => somarDias(j, DIAS_POR_JANELA))}
          disabled={fimJanela >= fim}
          aria-label="14 dias depois"
        >
          <ChevronRight className="h-[18px] w-[18px]" />
        </Button>
      </div>

      {imoveis.length === 0 ? (
        <p className="rounded-2xl border bg-card p-6 text-center text-sm text-gray-500">Nenhum imóvel no filtro.</p>
      ) : (
        // overflow-clip (e não hidden) para o cabeçalho poder grudar no topo da página
        <div className="rounded-2xl border bg-card shadow-sm [overflow:clip]">
          {/* Cabeçalho das datas: gruda abaixo da barra do topo */}
          <div className={cn(COLUNAS, 'sticky z-20 min-h-[34px] items-center border-b bg-gray-50 lg:min-h-11', TOPO_GRUDENTO)}>
            <span className="pl-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 lg:pl-4">
              <span className="sr-only">Imóveis</span>
            </span>
            {dias.map((d) => {
              const fora = d > fim || d < inicio;
              const ehHoje = d === hoje;
              return (
                <span
                  key={d}
                  title={rotuloDia(d, true)}
                  className={cn(
                    'mx-px rounded-md py-0.5 text-center font-mono text-[10px] leading-tight tabular-nums text-gray-500 lg:text-xs',
                    ehHoje && 'bg-brand-500 text-white',
                    fora && 'opacity-30',
                  )}
                >
                  {SEMANA_CURTA[diaDaSemana(d)]}
                  <br />
                  {Number(d.slice(8, 10))}
                </span>
              );
            })}
          </div>

          {imoveis.map((p) => {
            const nome = p.nickname || p.name;
            const barras = (porImovel.get(p.id) || [])
              .map((r) => {
                const ci = r.check_in_date.slice(0, 10);
                const co = r.check_out_date.slice(0, 10);
                if (co <= janela || ci > fimJanela) return null;
                const a = ci < janela ? 0 : noites(janela, ci);
                const b = co > fimJanela ? DIAS_POR_JANELA : noites(janela, co);
                if (b <= a) return null;
                return { r, a, b, corteEsq: ci < janela, corteDir: co > fimJanela };
              })
              .filter(Boolean) as { r: CalendarReservation; a: number; b: number; corteEsq: boolean; corteDir: boolean }[];

            return (
              <div key={p.id} className={cn(COLUNAS, 'relative min-h-10 items-center border-t first:border-t-0 lg:min-h-[52px]')}>
                {/* Fundo: hoje e dias fora do período */}
                {dias.map((d, i) =>
                  d === hoje || d > fim ? (
                    <span
                      key={d}
                      aria-hidden="true"
                      style={{ gridColumn: i + 2, gridRow: 1 }}
                      className={cn('self-stretch', d === hoje ? 'bg-brand-500/10' : 'bg-gray-100/70')}
                    />
                  ) : null,
                )}
                <button
                  type="button"
                  onClick={() => setImovelAberto(p.id)}
                  style={{ gridColumn: 1, gridRow: 1 }}
                  className="flex min-w-0 items-center self-stretch px-1.5 text-left text-[11.5px] font-semibold leading-tight text-gray-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand lg:px-4 lg:text-sm"
                  aria-label={`${nome}: abrir o mês só deste imóvel`}
                >
                  <span className="line-clamp-2 [overflow-wrap:normal] [word-break:normal]">{nome}</span>
                </button>
                {barras.map(({ r, a, b, corteEsq, corteDir }) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => aoTocarReserva(r)}
                    title={`${r.guest_name || 'Sem nome'} · ${rotuloDia(r.check_in_date)} → ${rotuloDia(r.check_out_date)} · ${r.platform}`}
                    aria-label={`${r.guest_name || 'Reserva'}, ${rotuloDia(r.check_in_date, true)} a ${rotuloDia(r.check_out_date, true)}, ${r.platform}`}
                    style={{ gridColumn: `${a + 2} / span ${b - a}`, gridRow: 1, background: corDoCanal(r.platform).css }}
                    className={cn(
                      'z-10 mx-px h-6 min-w-0 overflow-hidden whitespace-nowrap rounded-[7px] px-1 text-left text-[10px] font-semibold leading-6 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-1 lg:h-8 lg:px-2 lg:text-xs lg:leading-8',
                      corteEsq && 'ml-0 rounded-l-none',
                      corteDir && 'mr-0 rounded-r-none',
                    )}
                  >
                    {b - a >= 2 ? primeiroNome(r.guest_name) : ''}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {canais.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500" aria-hidden="true">
          {canais.map((c) => (
            <span key={c} className="flex items-center gap-1">
              <i className="h-2 w-3.5 rounded-sm" style={{ background: corDoCanal(c).css }} /> {c}
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500">Toque no nome de um imóvel para abrir o mês só dele.</p>
    </div>
  );
};

export default VisaoImoveis;
