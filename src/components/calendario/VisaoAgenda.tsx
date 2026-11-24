/**
 * Visão Agenda do Calendário (era "Lista"): só entradas e saídas, dia a dia,
 * nos dias do período do filtro global, 14 dias por vez a partir do 1º dia.
 * Cada saída diz quem faz a faxina ou avisa "Sem faxineira".
 */
import React, { useMemo } from 'react';
import { somarDias } from '@/components/pricing/ocupacao';
import { ListaLinhas } from '@/components/comum/GrupoLista';
import AjudaInfo from '@/components/comum/AjudaInfo';
import { Button } from '@/components/ui/button';
import { CalendarReservation } from '@/types/calendar';
import LinhaMovimento from './LinhaMovimento';
import { DIAS_POR_JANELA, DiaDoCalendario, SEMANA_ABREV, diaDaSemana, janelaQueContem, nomeDoImovel, rotuloDia, rotuloIntervalo } from './periodo';
import { useEstadoDoRecorte } from '@/hooks/useEstadoPersistente';

interface Props {
  inicio: string;
  fim: string;
  dias: Map<string, DiaDoCalendario>;
  nomesImoveis: Map<string, string>;
  faxineiras?: Map<string, string>;
  hoje: string;
  aoTocarReserva: (r: CalendarReservation) => void;
}

const minimo = (a: string, b: string) => (a < b ? a : b);

const VisaoAgenda = ({ inicio, fim, dias, nomesImoveis, faxineiras, hoje, aoTocarReserva }: Props) => {
  // O começo e os blocos de 14 dias já abertos voltam depois de recarregar, enquanto o período for o mesmo
  const recorte = `${inicio}|${fim}`;
  const [comeco, setComeco] = useEstadoDoRecorte<string>('calendario.agenda.comeco', recorte, inicio);
  const [blocos, setBlocos] = useEstadoDoRecorte<number>('calendario.agenda.blocos', recorte, 1);

  const ate = minimo(somarDias(comeco, DIAS_POR_JANELA * blocos - 1), fim);
  const contemHoje = hoje >= inicio && hoje <= fim;

  const diasComMovimento = useMemo(() => {
    const lista: { dia: string; info: DiaDoCalendario }[] = [];
    let d = comeco;
    while (d <= ate) {
      const info = dias.get(d);
      if (info && (info.entradas.length || info.saidas.length)) lista.push({ dia: d, info });
      d = somarDias(d, 1);
    }
    return lista;
  }, [comeco, ate, dias]);

  const proxIni = somarDias(ate, 1);
  const proxFim = minimo(somarDias(proxIni, DIAS_POR_JANELA - 1), fim);

  return (
    <div className="grid gap-2">
      <div className="flex min-h-10 items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-display text-base font-bold text-gray-900" aria-live="polite">
          {rotuloIntervalo(comeco, ate)}
        </p>
        {contemHoje && (hoje < comeco || hoje > ate) && (
          <Button
            variant="outline"
            size="sm"
            className="h-10 shrink-0 rounded-full px-3"
            onClick={() => {
              setComeco(janelaQueContem(inicio, hoje));
              setBlocos(1);
            }}
          >
            Hoje
          </Button>
        )}
        <AjudaInfo titulo="Agenda">Só as entradas e saídas, nos dias do período do filtro, 14 dias por vez. Toque numa linha para ver a reserva.</AjudaInfo>
      </div>

      {comeco > inicio && (
        <Button
          variant="outline"
          className="min-h-11 w-full rounded-full"
          onClick={() => {
            const novo = somarDias(comeco, -DIAS_POR_JANELA);
            setComeco(novo < inicio ? inicio : novo);
            setBlocos((b) => b + 1);
          }}
        >
          14 dias anteriores
        </Button>
      )}

      {diasComMovimento.length === 0 ? (
        <p className="rounded-2xl border bg-card p-5 text-center text-sm text-gray-500">Nenhuma entrada ou saída de {rotuloIntervalo(comeco, ate)}.</p>
      ) : (
        diasComMovimento.map(({ dia, info }) => (
          <section key={dia} className="min-w-0" aria-label={rotuloDia(dia, true)}>
            <h3 className="px-0.5 pb-1.5 pt-2 font-display text-xs font-bold uppercase tracking-wider text-gray-500">
              {SEMANA_ABREV[diaDaSemana(dia)]} · {rotuloDia(dia)}
              {dia === hoje && <span className="ml-1.5 rounded-full bg-brand-accent px-1.5 py-0.5 text-[10px] text-white">Hoje</span>}
            </h3>
            <div className="rounded-2xl border bg-card px-3.5 py-1 shadow-sm">
              <ListaLinhas>
                {info.saidas.map((r) => (
                  <LinhaMovimento key={`s-${r.id}`} tipo="saida" reserva={r} nomeImovel={nomeDoImovel(r, nomesImoveis)} faxineiras={faxineiras} hoje={hoje} aoTocar={aoTocarReserva} />
                ))}
                {info.entradas.map((r) => (
                  <LinhaMovimento key={`e-${r.id}`} tipo="entrada" reserva={r} nomeImovel={nomeDoImovel(r, nomesImoveis)} faxineiras={faxineiras} hoje={hoje} aoTocar={aoTocarReserva} />
                ))}
              </ListaLinhas>
            </div>
          </section>
        ))
      )}

      {ate < fim && (
        <Button variant="outline" className="mt-1 min-h-11 w-full rounded-full" onClick={() => setBlocos((b) => b + 1)}>
          Próximos 14 dias · {rotuloIntervalo(proxIni, proxFim)}
        </Button>
      )}
    </div>
  );
};

export default VisaoAgenda;
