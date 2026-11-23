/**
 * O mês de um imóvel só (abre ao tocar no nome em Imóveis): semana a semana,
 * cada reserva é uma faixa contínua na cor do canal, do check-in à véspera do
 * check-out. As setas andam de mês em mês dentro do período do filtro.
 */
import React, { useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { corDoCanal } from '@/components/comum/cores';
import { noites, somarDias } from '@/components/pricing/ocupacao';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CalendarReservation } from '@/types/calendar';
import { Property } from '@/types/property';
import { MesDoPeriodo, SEMANA_CURTA, primeiroNome, rotuloDia, semanasDoMes } from './periodo';

interface Props {
  imovel: Property;
  reservas: CalendarReservation[];
  meses: MesDoPeriodo[];
  mesInicial: number;
  hoje: string;
  aoVoltar: () => void;
  aoTocarReserva: (r: CalendarReservation) => void;
}

interface Faixa {
  r: CalendarReservation;
  /** Colunas 0–6 (fim exclusivo) */
  a: number;
  b: number;
  linha: number;
  comeca: boolean;
  termina: boolean;
}

/** Faixas de uma semana, em linhas que não se sobrepõem */
function faixasDaSemana(semana: (string | null)[], reservas: CalendarReservation[], mes: MesDoPeriodo): Faixa[] {
  // Só os dias do mês que estão dentro do período
  const validos = semana.map((d) => (d && d >= mes.inicio && d <= mes.fim ? d : null));
  const primeiro = validos.findIndex(Boolean);
  if (primeiro < 0) return [];
  const ultimo = validos.length - 1 - [...validos].reverse().findIndex(Boolean);
  const ini = validos[primeiro] as string;
  const fimExcl = somarDias(validos[ultimo] as string, 1);

  const faixas: Faixa[] = [];
  const ocupacaoLinhas: number[] = []; // fim (coluna) da última faixa de cada linha
  for (const r of [...reservas].sort((x, y) => x.check_in_date.localeCompare(y.check_in_date))) {
    const ci = r.check_in_date.slice(0, 10);
    const co = r.check_out_date.slice(0, 10);
    if (co <= ini || ci >= fimExcl) continue;
    const a = primeiro + (ci > ini ? noites(ini, ci) : 0);
    const b = primeiro + (co < fimExcl ? noites(ini, co) : noites(ini, fimExcl));
    if (b <= a) continue;
    let linha = ocupacaoLinhas.findIndex((fim) => fim <= a);
    if (linha < 0) {
      linha = ocupacaoLinhas.length;
      ocupacaoLinhas.push(b);
    } else ocupacaoLinhas[linha] = b;
    faixas.push({ r, a, b, linha, comeca: ci >= ini, termina: co <= fimExcl });
  }
  return faixas;
}

const MesDoImovel = ({ imovel, reservas, meses, mesInicial, hoje, aoVoltar, aoTocarReserva }: Props) => {
  const [i, setI] = useState(mesInicial);
  const mes = meses[i];
  const nome = imovel.nickname || imovel.name;
  const semanas = useMemo(() => (mes ? semanasDoMes(mes) : []), [mes]);

  const resumo = useMemo(() => {
    if (!mes) return { pct: 0, n: 0 };
    let ocupadas = 0;
    let n = 0;
    const fimExcl = somarDias(mes.fim, 1);
    for (const r of reservas) {
      const a = r.check_in_date > mes.inicio ? r.check_in_date.slice(0, 10) : mes.inicio;
      const b = r.check_out_date < fimExcl ? r.check_out_date.slice(0, 10) : fimExcl;
      if (b > a) {
        ocupadas += noites(a, b);
        n += 1;
      }
    }
    return { pct: Math.round((ocupadas / mes.dias) * 100), n };
  }, [mes, reservas]);

  if (!mes) return null;

  return (
    <div className="grid gap-3">
      <Button variant="ghost" className="min-h-11 justify-start gap-2 justify-self-start px-2 text-brand-700" onClick={aoVoltar}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Todos os imóveis
      </Button>

      <section className="min-w-0 rounded-2xl border bg-card px-3.5 py-3.5 shadow-sm" aria-label={`${nome}, ${mes.nome}`}>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="min-w-0 truncate font-display text-base font-bold text-gray-900">{nome}</h2>
          <span className="shrink-0 font-mono text-xs tabular-nums text-gray-500">
            {resumo.pct}% · {resumo.n} {resumo.n === 1 ? 'reserva' : 'reservas'}
          </span>
        </div>

        <div className="mb-2 flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={() => setI(i - 1)} disabled={i === 0} aria-label="Mês anterior">
            <ChevronLeft className="h-[18px] w-[18px]" />
          </Button>
          <p className="flex-1 text-center font-display text-sm font-bold text-gray-900" aria-live="polite">
            {mes.nome}
          </p>
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={() => setI(i + 1)} disabled={i === meses.length - 1} aria-label="Próximo mês">
            <ChevronRight className="h-[18px] w-[18px]" />
          </Button>
        </div>

        <div className="grid grid-cols-7" aria-hidden="true">
          {SEMANA_CURTA.map((d, k) => (
            <span key={k} className="pb-1 text-center text-[10.5px] font-semibold text-gray-500">
              {d}
            </span>
          ))}
        </div>

        <div className="divide-y divide-gray-100">
          {semanas.map((semana, k) => {
            const faixas = faixasDaSemana(semana, reservas, mes);
            const linhas = Math.max(1, ...faixas.map((f) => f.linha + 1));
            return (
              <div key={k} className="grid grid-cols-7 gap-y-1 py-1.5" style={{ gridTemplateRows: `auto repeat(${linhas}, 22px)` }}>
                {semana.map((d, j) => (
                  <span
                    key={j}
                    style={{ gridColumn: j + 1, gridRow: 1 }}
                    className={cn(
                      'mx-auto grid h-5 min-w-5 place-items-center rounded-full px-1 font-mono text-[11px] tabular-nums text-gray-600',
                      d === hoje && 'bg-brand-accent text-white',
                      (!d || d < mes.inicio || d > mes.fim) && 'opacity-30',
                    )}
                  >
                    {d ? Number(d.slice(8, 10)) : ''}
                  </span>
                ))}
                {faixas.map((f) => (
                  <button
                    key={f.r.id}
                    type="button"
                    onClick={() => aoTocarReserva(f.r)}
                    aria-label={`${f.r.guest_name || 'Reserva'}, ${rotuloDia(f.r.check_in_date, true)} a ${rotuloDia(f.r.check_out_date, true)}, ${f.r.platform}`}
                    style={{ gridColumn: `${f.a + 1} / span ${f.b - f.a}`, gridRow: f.linha + 2, background: corDoCanal(f.r.platform).css }}
                    className={cn(
                      'h-[22px] min-w-0 overflow-hidden whitespace-nowrap px-1.5 text-left text-[11px] font-semibold leading-[22px] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
                      f.comeca ? 'ml-1 rounded-l-md' : '',
                      f.termina ? 'mr-1 rounded-r-md' : '',
                    )}
                  >
                    {f.b - f.a >= 2 || f.comeca ? primeiroNome(f.r.guest_name) : ''}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default MesDoImovel;
