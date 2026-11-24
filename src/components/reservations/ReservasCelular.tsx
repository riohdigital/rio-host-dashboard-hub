/**
 * Reservas no celular (abaixo de 1024px), desenho `mReservas` do plano (T2):
 * busca + filtros + "+" numa linha → abas roláveis com contagem → faixa
 * Recebido · A receber (explicação atrás do "i") → reservas agrupadas por mês
 * com subtotal, 30 por vez. Cada linha abre a FolhaReserva (D5: status,
 * faxina, comunicado, recibo, editar e excluir só lá).
 *
 * Recebe as reservas já filtradas e os totais já calculados pela
 * ReservasPage; aqui só se organiza o que já foi carregado.
 */
import React, { useMemo } from 'react';
import { CalendarX, Plus, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AbasRolaveis from '@/components/comum/AbasRolaveis';
import AjudaInfo from '@/components/comum/AjudaInfo';
import BarraBusca, { BotaoBarra } from '@/components/comum/BarraBusca';
import Escolhas from '@/components/comum/Escolhas';
import EstadoVazio from '@/components/comum/EstadoVazio';
import FolhaDetalhes from '@/components/comum/FolhaDetalhes';
import GrupoLista from '@/components/comum/GrupoLista';
import LinhaLista from '@/components/comum/LinhaLista';
import { formatarMoedaSemCentavos } from '@/components/comum/formatos';
import { useEstadoPersistente, useQuantasPersistente } from '@/hooks/useEstadoPersistente';
import { emCurso, hojeISO, nomeDoMes, periodoCurto } from './datas';
import { ROTULO_DA_SITUACAO, TOM_DA_SITUACAO, situacaoDoPagamento } from './pagamento';

const POR_VEZ = 30;

export interface AbaReservas {
  valor: string;
  rotulo: string;
  curto: string;
  total: number;
  ajuda: string;
}

export interface TotaisReservas {
  count: number;
  netRevenue: number;
  totalRevenue: number;
  receivedNetRevenue: number;
  futureNetRevenue: number;
  paidCount: number;
  pendingCount: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- as reservas chegam do Supabase sem tipo (select('*, properties!inner(*)')) */
interface ReservasCelularProps {
  /** Reservas da aba atual, já filtradas pela busca e pelos filtros */
  reservas: any[];
  abas: AbaReservas[];
  aba: string;
  aoMudarAba: (aba: string) => void;
  busca: string;
  aoBuscar: (texto: string) => void;
  status: string;
  aoMudarStatus: (status: string) => void;
  pagamento: string;
  aoMudarPagamento: (pagamento: string) => void;
  totais: TotaisReservas;
  podeCriar: boolean;
  aoNova: () => void;
  aoTocar: (reserva: any) => void;
}

const OPCOES_STATUS = [
  { valor: 'all', rotulo: 'Todos' },
  { valor: 'Confirmada', rotulo: 'Confirmada' },
  { valor: 'Em Andamento', rotulo: 'Em andamento' },
  { valor: 'Finalizada', rotulo: 'Finalizada' },
  { valor: 'Cancelada', rotulo: 'Cancelada' },
];
const OPCOES_PAGAMENTO = [
  { valor: 'all', rotulo: 'Todos' },
  { valor: 'Pago', rotulo: 'Pago' },
  { valor: 'Pendente', rotulo: 'Pendente' },
];

const ReservasCelular = ({
  reservas,
  abas,
  aba,
  aoMudarAba,
  busca,
  aoBuscar,
  status,
  aoMudarStatus,
  pagamento,
  aoMudarPagamento,
  totais,
  podeCriar,
  aoNova,
  aoTocar,
}: ReservasCelularProps) => {
  // Volta para as 30 primeiras quando a lista muda de recorte; no mesmo
  // recorte, o "Carregar mais" é lembrado ao recarregar a página.
  const [quantas, setQuantas] = useQuantasPersistente('reservas.quantas', [aba, busca, status, pagamento].join('|'), POR_VEZ);
  const [filtrosAbertos, setFiltrosAbertos] = useEstadoPersistente<boolean>('reservas.filtros.abertos', false);

  // Subtotal de cada mês sobre a lista inteira (não só as já carregadas)
  const subtotais = useMemo(() => {
    const m = new Map<string, { n: number; soma: number }>();
    reservas.forEach((r) => {
      const chave = (r.check_in_date || '').slice(0, 7);
      const s = m.get(chave) ?? { n: 0, soma: 0 };
      s.n += 1;
      s.soma += Number(r.net_revenue) || 0;
      m.set(chave, s);
    });
    return m;
  }, [reservas]);

  // As carregadas, na ordem da lista, em blocos por mês de entrada
  const grupos = useMemo(() => {
    const lista: { chave: string; itens: any[] }[] = [];
    reservas.slice(0, quantas).forEach((r) => {
      const chave = (r.check_in_date || '').slice(0, 7);
      const ultimo = lista[lista.length - 1];
      if (ultimo && ultimo.chave === chave) ultimo.itens.push(r);
      else lista.push({ chave, itens: [r] });
    });
    return lista;
  }, [reservas, quantas]);

  const hoje = hojeISO();
  const filtrosAtivos = (status !== 'all' ? 1 : 0) + (pagamento !== 'all' ? 1 : 0);
  const abaAtual = abas.find((a) => a.valor === aba);
  const restantes = reservas.length - quantas;
  const caixa = aba === 'cashflow';

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <BarraBusca valor={busca} aoMudar={aoBuscar} placeholder="Buscar hóspede" rotulo="Buscar por hóspede, código ou imóvel">
        <BotaoBarra icone={SlidersHorizontal} rotulo="Filtros" contagem={filtrosAtivos} aoClicar={() => setFiltrosAbertos(true)} />
        {podeCriar && <BotaoBarra icone={Plus} rotulo="Nova reserva" primario aoClicar={aoNova} />}
      </BarraBusca>

      <AbasRolaveis
        rotulo="Recortes das reservas"
        sangrar
        valor={aba}
        aoMudar={aoMudarAba}
        itens={abas.map((a) => ({ valor: a.valor, rotulo: a.rotulo, curto: a.curto, contagem: a.total }))}
      />

      <section className="flex min-w-0 items-center gap-3 rounded-2xl border bg-card px-3.5 py-2.5 shadow-sm" aria-label="Resumo da aba">
        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-3">
          {caixa ? (
            <>
              <div className="min-w-0">
                <dt className="truncate text-xs text-gray-500">Recebido</dt>
                <dd className="truncate font-mono text-sm font-semibold tabular-nums text-success-700">{formatarMoedaSemCentavos(totais.receivedNetRevenue)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="truncate text-xs text-gray-500">A receber</dt>
                <dd className="truncate font-mono text-sm font-semibold tabular-nums text-warning-700">{formatarMoedaSemCentavos(totais.futureNetRevenue)}</dd>
              </div>
            </>
          ) : (
            <>
              <div className="min-w-0">
                <dt className="truncate text-xs text-gray-500">Líquido</dt>
                <dd className="truncate font-mono text-sm font-semibold tabular-nums text-success-700">{formatarMoedaSemCentavos(totais.netRevenue)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="truncate text-xs text-gray-500">Pagas</dt>
                <dd className="truncate font-mono text-sm font-semibold tabular-nums text-gray-900">
                  {totais.paidCount} de {totais.count}
                </dd>
              </div>
            </>
          )}
        </dl>
        {abaAtual && (
          <AjudaInfo titulo={abaAtual.rotulo} rotulo={`Sobre ${abaAtual.curto}`}>
            <p>{abaAtual.ajuda}</p>
            <p className="mt-2 font-mono text-xs tabular-nums text-gray-500">
              {totais.count} {totais.count === 1 ? 'reserva' : 'reservas'} · líquido {formatarMoedaSemCentavos(totais.netRevenue)} · bruto{' '}
              {formatarMoedaSemCentavos(totais.totalRevenue)}
            </p>
          </AjudaInfo>
        )}
      </section>

      {reservas.length === 0 ? (
        <EstadoVazio icone={CalendarX} titulo="Nenhuma reserva aqui" descricao="Ajuste a busca, os filtros ou o período no topo." />
      ) : (
        <>
          {grupos.map((g) => {
            const s = subtotais.get(g.chave);
            return (
              <GrupoLista
                key={g.chave}
                titulo={nomeDoMes(g.chave)}
                resumo={s ? `${s.n} ${s.n === 1 ? 'reserva' : 'reservas'} · ${formatarMoedaSemCentavos(s.soma)}` : undefined}
              >
                {g.itens.map((r) => {
                  const situacao = situacaoDoPagamento(r);
                  const cancelada = situacao === 'cancelada';
                  const imovel = r.properties?.nickname || r.properties?.name || 'Imóvel';
                  return (
                    <LinhaLista
                      key={r.id}
                      className="min-h-[76px]"
                      canal={r.platform}
                      titulo={r.guest_name || 'Hóspede sem nome'}
                      subtitulo={`${imovel} · ${periodoCurto(r.check_in_date, r.check_out_date)}${!cancelada && emCurso(r.check_in_date, r.check_out_date, hoje) ? ' · hospedado' : ''}`}
                      valor={formatarMoedaSemCentavos(r.net_revenue)}
                      legenda={ROTULO_DA_SITUACAO[situacao]}
                      tomLegenda={TOM_DA_SITUACAO[situacao]}
                      aoTocar={() => aoTocar(r)}
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
                ({quantas} de {reservas.length})
              </span>
            </Button>
          )}
        </>
      )}

      <FolhaDetalhes
        aberta={filtrosAbertos}
        aoMudar={setFiltrosAbertos}
        titulo="Filtros"
        subtitulo="O período e os imóveis ficam no filtro do topo."
        acoes={
          <>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={filtrosAtivos === 0}
              onClick={() => {
                aoMudarStatus('all');
                aoMudarPagamento('all');
              }}
            >
              Limpar
            </Button>
            <Button type="button" className="rounded-full" onClick={() => setFiltrosAbertos(false)}>
              Ver {reservas.length} {reservas.length === 1 ? 'reserva' : 'reservas'}
            </Button>
          </>
        }
      >
        <Escolhas rotulo="Situação da reserva" opcoes={OPCOES_STATUS} valor={status} aoMudar={aoMudarStatus} />
        <Escolhas rotulo="Pagamento" opcoes={OPCOES_PAGAMENTO} valor={pagamento} aoMudar={aoMudarPagamento} />
      </FolhaDetalhes>
    </div>
  );
};

export default ReservasCelular;
