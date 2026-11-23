/**
 * Visão Mês do Calendário (regra D2): um bloco por mês do período do filtro
 * global, um abaixo do outro. Até 3 meses aparecem todos; com mais, abre os 3
 * primeiros e o botão "Mostrar mais 3 meses". No topo, a faixa dos meses
 * (ocupação de cada um; tocar abre os blocos até ele e rola até lá) e as
 * setas, que andam de mês em mês só dentro do período.
 *
 * Celular: cada dia mostra "ocupados/total" com o roxo mais forte quanto mais
 * ocupado, ponto verde = entrada, laranja = saída. Computador: a grade de
 * sempre, com as reservas dentro do dia. Nos dois, tocar no dia abre logo
 * abaixo do mês a lista de quem entra, sai e está hospedado.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Bloco from '@/components/comum/Bloco';
import { ListaLinhas } from '@/components/comum/GrupoLista';
import VerTodos from '@/components/comum/VerTodos';
import { useListaCurta } from '@/components/comum/useListaCurta';
import { Button } from '@/components/ui/button';
import { useEhCompacto } from '@/hooks/useMidia';
import { cn } from '@/lib/utils';
import { CalendarReservation } from '@/types/calendar';
import { Property } from '@/types/property';
import { DayCell } from './DayCell';
import LinhaMovimento, { TipoMovimento } from './LinhaMovimento';
import {
  DiaDoCalendario,
  MESES_POR_VEZ,
  MesDoPeriodo,
  TOPO_GRUDENTO,
  SEMANA_ABREV,
  SEMANA_CURTA,
  nomeDoImovel,
  resumoDoMes,
  rotuloDia,
  rotuloDiaComSemana,
  semanasDoMes,
} from './periodo';

interface Props {
  meses: MesDoPeriodo[];
  dias: Map<string, DiaDoCalendario>;
  imoveis: Property[];
  nomesImoveis: Map<string, string>;
  faxineiras?: Map<string, string>;
  hoje: string;
  aoTocarReserva: (r: CalendarReservation) => void;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Lista do dia tocado: quem entra, quem sai e quem está hospedado (3 + "Mais N") */
const ListaDoDia = ({
  dia,
  info,
  totalImoveis,
  nomesImoveis,
  faxineiras,
  hoje,
  aoTocarReserva,
}: {
  dia: string;
  info?: DiaDoCalendario;
  totalImoveis: number;
  nomesImoveis: Map<string, string>;
  faxineiras?: Map<string, string>;
  hoje: string;
  aoTocarReserva: (r: CalendarReservation) => void;
}) => {
  const itens = useMemo(() => {
    const lista: { tipo: TipoMovimento; r: CalendarReservation }[] = [];
    info?.entradas.forEach((r) => lista.push({ tipo: 'entrada', r }));
    info?.saidas.forEach((r) => lista.push({ tipo: 'saida', r }));
    info?.hospedados.forEach((r) => lista.push({ tipo: 'hospedado', r }));
    return lista;
  }, [info]);
  const lista = useListaCurta(itens, 3);
  const restantes = itens.slice(3);
  const soHospedados = restantes.length > 0 && restantes.every((x) => x.tipo === 'hospedado');

  return (
    <Bloco titulo={rotuloDiaComSemana(dia)} extra={`${info?.ocupados ?? 0} de ${totalImoveis} ocupados`} compacto={itens.length > 0}>
      {itens.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma entrada, saída ou hóspede neste dia.</p>
      ) : (
        <>
          <ListaLinhas>
            {lista.visiveis.map(({ tipo, r }) => (
              <LinhaMovimento
                key={`${tipo}-${r.id}`}
                tipo={tipo}
                reserva={r}
                nomeImovel={nomeDoImovel(r, nomesImoveis)}
                faxineiras={faxineiras}
                hoje={hoje}
                mostrarCanal
                aoTocar={aoTocarReserva}
              />
            ))}
          </ListaLinhas>
          {lista.temMais && (
            <VerTodos
              expandido={lista.expandido}
              aoClicar={lista.alternar}
              rotulo={`Mais ${restantes.length}${soHospedados ? (restantes.length > 1 ? ' hospedados' : ' hospedado') : ''}`}
            />
          )}
        </>
      )}
    </Bloco>
  );
};

/** Um dia na grade do celular */
const CelulaDia = ({
  dia,
  info,
  totalImoveis,
  dentro,
  hoje,
  selecionado,
  aoTocar,
}: {
  dia: string;
  info?: DiaDoCalendario;
  totalImoveis: number;
  dentro: boolean;
  hoje: boolean;
  selecionado: boolean;
  aoTocar: () => void;
}) => {
  const n = Number(dia.slice(8, 10));
  if (!dentro) {
    return (
      <span className="grid h-10 place-items-center rounded-[10px] bg-gray-50 text-[13px] font-semibold text-gray-300" aria-hidden="true">
        {n}
      </span>
    );
  }
  const ocupados = info?.ocupados ?? 0;
  const frac = totalImoveis > 0 ? ocupados / totalImoveis : 0;
  const alfa = ocupados === 0 ? 0.06 : 0.16 + frac * 0.72;
  const forte = alfa >= 0.5;
  const entradas = info?.entradas.length ?? 0;
  const saidas = info?.saidas.length ?? 0;
  const rotulo = [
    rotuloDia(dia, true),
    `${ocupados} de ${totalImoveis} ocupados`,
    entradas ? `${entradas} ${entradas > 1 ? 'entradas' : 'entrada'}` : '',
    saidas ? `${saidas} ${saidas > 1 ? 'saídas' : 'saída'}` : '',
    hoje ? 'hoje' : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={selecionado}
      aria-label={rotulo}
      style={{ backgroundColor: `hsl(var(--brand) / ${alfa.toFixed(2)})` }}
      className={cn(
        'relative grid h-10 min-w-0 content-center justify-items-center gap-px rounded-[10px] transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
        selecionado ? 'ring-2 ring-gray-900' : hoje && 'ring-2 ring-brand-accent',
      )}
    >
      {entradas > 0 && <span className="absolute left-1 top-1 h-[5px] w-[5px] rounded-full bg-success-500 ring-[1.5px] ring-white" aria-hidden="true" />}
      {saidas > 0 && <span className="absolute right-1 top-1 h-[5px] w-[5px] rounded-full bg-warning-500 ring-[1.5px] ring-white" aria-hidden="true" />}
      <span className={cn('text-[13px] font-semibold leading-none', forte ? 'text-white' : 'text-gray-900', hoje && !forte && 'text-brand-700')}>{n}</span>
      <span className={cn('font-mono text-[9px] leading-none', forte ? 'text-white' : 'text-gray-600')}>
        {ocupados}/{totalImoveis}
      </span>
    </button>
  );
};

const VisaoMes = ({ meses, dias, imoveis, nomesImoveis, faxineiras, hoje, aoTocarReserva }: Props) => {
  const compacto = useEhCompacto();
  const totalImoveis = imoveis.length;
  const [abertos, setAbertos] = useState(() => Math.min(meses.length, MESES_POR_VEZ));
  const [foco, setFoco] = useState(0);
  const [diaSel, setDiaSel] = useState<string | null>(() => (hoje >= (meses[0]?.inicio ?? '') && hoje <= (meses[meses.length - 1]?.fim ?? '') ? hoje : null));
  const [rolarPara, setRolarPara] = useState<number | null>(null);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const faixaRef = useRef<HTMLDivElement | null>(null);
  // Depois de um toque na faixa ou nas setas, a rolagem não troca o mês em foco por um instante
  const travaFoco = useRef(0);

  const resumos = useMemo(() => meses.map((m) => resumoDoMes(m, dias, totalImoveis)), [meses, dias, totalImoveis]);
  const idxHoje = meses.findIndex((m) => hoje >= m.inicio && hoje <= m.fim);

  // Rola até o bloco pedido depois que ele aparece
  useEffect(() => {
    if (rolarPara === null) return;
    const el = refs.current[rolarPara];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setRolarPara(null);
    }
  }, [rolarPara, abertos]);

  // O mês em foco acompanha a rolagem (o bloco mais acima que ainda aparece)
  useEffect(() => {
    if (meses.length < 2 || typeof IntersectionObserver === 'undefined') return;
    const visiveis = new Map<number, boolean>();
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) visiveis.set(Number((e.target as HTMLElement).dataset.indice), e.isIntersecting);
        if (Date.now() < travaFoco.current) return;
        const primeiro = [...visiveis.entries()].filter(([, v]) => v).map(([i]) => i).sort((a, b) => a - b)[0];
        if (primeiro !== undefined) setFoco(primeiro);
      },
      { rootMargin: '-140px 0px -45% 0px' },
    );
    refs.current.slice(0, abertos).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [abertos, meses.length]);

  // A pílula do mês em foco entra inteira na faixa
  useEffect(() => {
    // Só de lado: scrollIntoView também rolaria a página e desfaria a ida até o mês
    const faixa = faixaRef.current;
    const pilula = faixa?.querySelector<HTMLElement>(`[data-indice="${foco}"]`);
    if (!faixa || !pilula) return;
    const esq = pilula.offsetLeft - faixa.offsetLeft;
    if (esq < faixa.scrollLeft + 16) faixa.scrollTo({ left: Math.max(0, esq - 16), behavior: 'smooth' });
    else if (esq + pilula.offsetWidth > faixa.scrollLeft + faixa.clientWidth - 16)
      faixa.scrollTo({ left: esq + pilula.offsetWidth - faixa.clientWidth + 16, behavior: 'smooth' });
  }, [foco]);

  const irPara = (i: number) => {
    const alvo = Math.max(0, Math.min(meses.length - 1, i));
    setAbertos((a) => Math.max(a, Math.min(meses.length, Math.ceil((alvo + 1) / MESES_POR_VEZ) * MESES_POR_VEZ)));
    setFoco(alvo);
    setRolarPara(alvo);
    travaFoco.current = Date.now() + 1200;
  };

  const proximos = meses.slice(abertos, abertos + MESES_POR_VEZ);
  const rotuloMais =
    proximos.length === 0
      ? ''
      : proximos.length === 1
        ? `Mostrar ${proximos[0].nome.toLowerCase()}`
        : `Mostrar mais ${proximos.length} meses · ${proximos[0].nome.toLowerCase()} a ${proximos[proximos.length - 1].nome.toLowerCase()}`;

  if (meses.length === 0) return null;

  return (
    <div className="grid gap-3">
      {/* Faixa dos meses: só com 2 meses ou mais */}
      {meses.length >= 2 && (
        <div ref={faixaRef} className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-0.5 lg:mx-0 lg:px-0" role="list" aria-label="Meses do período">
          {meses.map((m, i) => (
            <button
              key={m.chave}
              type="button"
              role="listitem"
              data-indice={i}
              onClick={() => irPara(i)}
              aria-label={`${m.nome}: ${pct(resumos[i].ocupacao)} ocupado${i === idxHoje ? ', mês de hoje' : ''}`}
              aria-current={i === foco ? 'true' : undefined}
              className={cn(
                'grid w-[52px] shrink-0 justify-items-center gap-1 rounded-xl border bg-card px-1 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:w-16',
                i < abertos && 'border-brand-200 bg-brand-50',
                i === foco && 'border-brand-500',
                i === idxHoje && 'border-brand-accent ring-1 ring-brand-accent',
              )}
            >
              <span className="text-xs font-semibold text-gray-900">{m.curto}</span>
              <span className="h-1 w-[30px] overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                <span className="block h-full rounded-full bg-brand-500" style={{ width: pct(resumos[i].ocupacao) }} />
              </span>
              <span className="font-mono text-[10px] tabular-nums text-gray-500">{pct(resumos[i].ocupacao)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Setas: de mês em mês, só dentro do período */}
      {meses.length >= 2 && (
        <div className={cn('sticky z-20 -mx-4 flex items-center gap-2 bg-surface/95 px-4 py-1 backdrop-blur lg:mx-0 lg:px-0', TOPO_GRUDENTO)}>
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={() => irPara(foco - 1)} disabled={foco === 0} aria-label="Mês anterior">
            <ChevronLeft className="h-[18px] w-[18px]" />
          </Button>
          <p className="min-w-0 flex-1 truncate text-center font-display text-base font-bold text-gray-900" aria-live="polite">
            {meses[foco]?.nome} <span className="font-body text-xs font-medium text-gray-500">· {foco + 1} de {meses.length}</span>
          </p>
          {idxHoje >= 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-10 shrink-0 rounded-full px-3"
              onClick={() => {
                setDiaSel(hoje);
                irPara(idxHoje);
              }}
            >
              Hoje
            </Button>
          )}
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={() => irPara(foco + 1)} disabled={foco === meses.length - 1} aria-label="Próximo mês">
            <ChevronRight className="h-[18px] w-[18px]" />
          </Button>
        </div>
      )}

      {meses.slice(0, abertos).map((m, i) => {
        const semanas = semanasDoMes(m);
        const diaDoMes = diaSel && diaSel >= m.inicio && diaSel <= m.fim ? diaSel : null;
        const tocarDia = (d: string) => setDiaSel((atual) => (atual === d ? null : d));
        return (
          <React.Fragment key={m.chave}>
            <section
              ref={(el) => (refs.current[i] = el)}
              data-indice={i}
              aria-label={m.nome}
              className="min-w-0 scroll-mt-[calc(3.5rem+4.5rem+env(safe-area-inset-top))] rounded-2xl border bg-card px-3.5 py-3.5 shadow-sm lg:scroll-mt-20"
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <h2 className="font-display text-base font-bold text-gray-900">{m.nome}</h2>
                <span className="font-mono text-xs tabular-nums text-gray-500">
                  {pct(resumos[i].ocupacao)} · {resumos[i].reservas} {resumos[i].reservas === 1 ? 'reserva' : 'reservas'}
                </span>
              </div>

              {compacto ? (
                <>
                  <div className="mb-1 grid grid-cols-7 gap-1" aria-hidden="true">
                    {SEMANA_CURTA.map((d, k) => (
                      <span key={k} className="text-center text-[10.5px] font-semibold text-gray-500">
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {semanas.flat().map((d, k) =>
                      d === null ? (
                        <span key={`v${k}`} aria-hidden="true" />
                      ) : (
                        <CelulaDia
                          key={d}
                          dia={d}
                          info={dias.get(d)}
                          totalImoveis={totalImoveis}
                          dentro={d >= m.inicio && d <= m.fim}
                          hoje={d === hoje}
                          selecionado={d === diaSel}
                          aoTocar={() => tocarDia(d)}
                        />
                      ),
                    )}
                  </div>
                </>
              ) : (
                <div className="overflow-hidden rounded-xl border">
                  <div className="grid grid-cols-7 border-b bg-gray-50">
                    {SEMANA_ABREV.map((d) => (
                      <div key={d} className="p-2 text-center text-xs font-semibold text-gray-500">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="divide-y">
                    {semanas.map((semana, k) => (
                      <div key={k} className="grid grid-cols-7 divide-x [&>*]:min-w-0">
                        {semana.map((d, j) => {
                          if (d === null) return <div key={`v${j}`} className="bg-gray-50/60" aria-hidden="true" />;
                          const info = dias.get(d);
                          const dentro = d >= m.inicio && d <= m.fim;
                          return (
                            <DayCell
                              key={d}
                              dia={d}
                              reservations={dentro ? [...(info?.entradas ?? []), ...(info?.hospedados ?? [])] : []}
                              nomesImoveis={nomesImoveis}
                              foraDoPeriodo={!dentro}
                              hoje={d === hoje}
                              selecionado={d === diaSel}
                              ocupacao={dentro ? `${info?.ocupados ?? 0}/${totalImoveis}` : undefined}
                              entradas={info?.entradas.length ?? 0}
                              saidas={info?.saidas.length ?? 0}
                              onReservationClick={aoTocarReserva}
                              onDayClick={dentro ? () => tocarDia(d) : undefined}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {diaDoMes && (
              <ListaDoDia
                key={diaDoMes}
                dia={diaDoMes}
                info={dias.get(diaDoMes)}
                totalImoveis={totalImoveis}
                nomesImoveis={nomesImoveis}
                faxineiras={faxineiras}
                hoje={hoje}
                aoTocarReserva={aoTocarReserva}
              />
            )}
          </React.Fragment>
        );
      })}

      {proximos.length > 0 && (
        <Button variant="outline" className="min-h-11 w-full rounded-full" onClick={() => setAbertos((a) => Math.min(meses.length, a + MESES_POR_VEZ))}>
          {rotuloMais}
        </Button>
      )}

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-gray-500" aria-hidden="true">
        <span className="flex items-center gap-1 lg:hidden">
          <i className="h-2 w-3.5 rounded-sm bg-brand-500" /> Mais ocupado
        </span>
        <span className="flex items-center gap-1">
          <i className="h-2 w-2 rounded-full bg-success-500" /> Entrada
        </span>
        <span className="flex items-center gap-1">
          <i className="h-2 w-2 rounded-full bg-warning-500" /> Saída
        </span>
      </div>
    </div>
  );
};

export default VisaoMes;
