/**
 * Despesas no celular (abaixo de 1024px), desenho `mDesp` do plano (T4):
 * faixa de resumo (total do período; fixas, variáveis, a reembolsar) →
 * busca + "Nova" → abas Todas/Fixas/Variáveis/Reembolsos → despesas em linhas
 * de 64px agrupadas por mês com subtotal, 12 por vez (fechando o mês). Tocar abre a folha de
 * detalhes com editar, marcar como paga/reembolsada, ver a recorrência e excluir.
 *
 * Recebe as despesas já carregadas pela ExpensesList e as ações dela; aqui só
 * se organiza o que já foi carregado.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Plus, Receipt, RefreshCw, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AbasRolaveis from '@/components/comum/AbasRolaveis';
import BarraBusca, { BotaoBarra } from '@/components/comum/BarraBusca';
import EstadoVazio from '@/components/comum/EstadoVazio';
import FaixaResumo from '@/components/comum/FaixaResumo';
import FolhaDetalhes from '@/components/comum/FolhaDetalhes';
import GrupoLista from '@/components/comum/GrupoLista';
import LinhaLista from '@/components/comum/LinhaLista';
import { formatarData, formatarMoeda, formatarMoedaSemCentavos } from '@/components/comum/formatos';
import { dataCurta, nomeDoMes } from '@/components/reservations/datas';
import type { Expense } from '@/types/expense';

/** Primeiras linhas mostradas; o corte sempre fecha o mês (nunca para no meio de um) */
const POR_VEZ = 12;

/** Nota enviada por faxineira/gestor que ainda não foi reembolsada (mesma regra da lista do computador) */
const ehReembolsoPendente = (d: Expense) =>
  d.payment_status === 'Reembolso Pendente' ||
  (!!d.description && d.description.toLowerCase().includes('[reembolso faxineira]') && d.payment_status !== 'Pago');

const ehReembolso = (d: Expense) =>
  d.payment_status === 'Reembolso Pendente' || (!!d.description && d.description.toLowerCase().includes('[reembolso faxineira]'));

const ehFixa = (d: Expense) => d.expense_type === 'Fixo';

const nomeImovel = (d: Expense) => d.properties?.nickname || d.properties?.name || '';

/** "Pago", "A reembolsar", "Reembolsado" ou "A pagar" */
function situacao(d: Expense): { texto: string; tom: 'success' | 'warning' } {
  if (ehReembolsoPendente(d)) return { texto: 'A reembolsar', tom: 'warning' };
  if (ehReembolso(d)) return { texto: 'Reembolsado', tom: 'success' };
  if (d.payment_status === 'Pago') return { texto: 'Pago', tom: 'success' };
  return { texto: 'A pagar', tom: 'warning' };
}

interface DespesasCelularProps {
  despesas: Expense[];
  totalAReembolsar: number;
  podeCriar: boolean;
  podeEditar: boolean;
  aoNova: () => void;
  aoEditar: (despesa: Expense) => void;
  /** Sem confirmação: a folha já confirmou */
  aoExcluir: (id: string) => Promise<void>;
  aoMarcarPaga: (id: string) => Promise<void> | void;
  /** Abre a janela da recorrência (todas as ocorrências do grupo) */
  aoVerRecorrencia: (grupoId: string) => void;
}

const DespesasCelular = ({
  despesas,
  totalAReembolsar,
  podeCriar,
  podeEditar,
  aoNova,
  aoEditar,
  aoExcluir,
  aoMarcarPaga,
  aoVerRecorrencia,
}: DespesasCelularProps) => {
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState('todas');
  const [quantas, setQuantas] = useState(POR_VEZ);
  const [selId, setSelId] = useState<string | null>(null);
  const [aberta, setAberta] = useState(false);

  useEffect(() => setQuantas(POR_VEZ), [aba, busca]);

  const soma = (lista: Expense[]) => lista.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const total = useMemo(() => soma(despesas), [despesas]);
  const fixas = useMemo(() => despesas.filter(ehFixa), [despesas]);
  const variaveis = useMemo(() => despesas.filter((d) => !ehFixa(d)), [despesas]);
  const reembolsos = useMemo(() => despesas.filter(ehReembolsoPendente), [despesas]);

  const lista = useMemo(() => {
    const base = aba === 'fixas' ? fixas : aba === 'variaveis' ? variaveis : aba === 'reembolsos' ? reembolsos : despesas;
    const termo = busca.trim().toLowerCase();
    if (!termo) return base;
    return base.filter(
      (d) =>
        (d.description || '').toLowerCase().includes(termo) ||
        (d.category || '').toLowerCase().includes(termo) ||
        nomeImovel(d).toLowerCase().includes(termo),
    );
  }, [aba, busca, despesas, fixas, variaveis, reembolsos]);

  const subtotais = useMemo(() => {
    const m = new Map<string, { n: number; soma: number }>();
    lista.forEach((d) => {
      const chave = (d.expense_date || '').slice(0, 7);
      const s = m.get(chave) ?? { n: 0, soma: 0 };
      s.n += 1;
      s.soma += Number(d.amount) || 0;
      m.set(chave, s);
    });
    return m;
  }, [lista]);

  const grupos = useMemo(() => {
    const g: { chave: string; itens: Expense[] }[] = [];
    let n = 0;
    for (const d of lista) {
      const chave = (d.expense_date || '').slice(0, 7);
      const ultimo = g[g.length - 1];
      // Passou do corte: só continua até fechar o mês que está aberto
      if (n >= quantas && (!ultimo || ultimo.chave !== chave)) break;
      if (ultimo && ultimo.chave === chave) ultimo.itens.push(d);
      else g.push({ chave, itens: [d] });
      n += 1;
    }
    return g;
  }, [lista, quantas]);
  const mostradas = grupos.reduce((s, g) => s + g.itens.length, 0);

  const sel = selId ? despesas.find((d) => d.id === selId) ?? null : null;
  // Guarda a última aberta enquanto a folha desce (a lista recarrega depois de excluir)
  const [ultima, setUltima] = useState<Expense | null>(null);
  useEffect(() => {
    if (sel) setUltima(sel);
  }, [sel]);
  const d = sel ?? ultima;
  const restantes = lista.length - mostradas;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <FaixaResumo
        rotulo="Total do período"
        valor={formatarMoedaSemCentavos(total)}
        apoio={[
          { rotulo: 'Fixas', valor: formatarMoedaSemCentavos(soma(fixas)) },
          { rotulo: 'Variáveis', valor: formatarMoedaSemCentavos(soma(variaveis)) },
          { rotulo: 'A reembolsar', valor: formatarMoedaSemCentavos(totalAReembolsar), tom: totalAReembolsar > 0 ? 'warning' : 'neutro' },
        ]}
        ajuda="Soma das despesas com data dentro do período do filtro do topo. A reembolsar: notas e comprovantes enviados por faxineiras ou gestores pelo chat da IA que ainda não foram pagos."
      />

      <BarraBusca valor={busca} aoMudar={setBusca} placeholder="Buscar despesa">
        {podeCriar && <BotaoBarra icone={Plus} rotulo="Nova despesa" texto="Nova" primario aoClicar={aoNova} />}
      </BarraBusca>

      <AbasRolaveis
        rotulo="Tipos de despesa"
        sangrar
        valor={aba}
        aoMudar={setAba}
        itens={[
          { valor: 'todas', rotulo: 'Todas', contagem: despesas.length },
          { valor: 'fixas', rotulo: 'Fixas', contagem: fixas.length },
          { valor: 'variaveis', rotulo: 'Variáveis', contagem: variaveis.length },
          { valor: 'reembolsos', rotulo: 'Reembolsos', contagem: reembolsos.length },
        ]}
      />

      {lista.length === 0 ? (
        <EstadoVazio
          icone={aba === 'reembolsos' ? Receipt : Tag}
          titulo={aba === 'reembolsos' ? 'Nenhum reembolso pendente' : 'Nenhuma despesa aqui'}
          descricao={busca ? 'Nada encontrado com essa busca.' : 'Ajuste o período ou os imóveis no filtro do topo.'}
        />
      ) : (
        <>
          {grupos.map((g) => {
            const s = subtotais.get(g.chave);
            return (
              <GrupoLista
                key={g.chave}
                titulo={nomeDoMes(g.chave)}
                resumo={s ? `${s.n} ${s.n === 1 ? 'despesa' : 'despesas'} · ${formatarMoedaSemCentavos(s.soma)}` : undefined}
              >
                {g.itens.map((item) => {
                  const st = situacao(item);
                  return (
                    <LinhaLista
                      key={item.id}
                      icone={item.is_recurrent ? RefreshCw : ehReembolso(item) ? Receipt : Tag}
                      tomIcone={ehReembolsoPendente(item) ? 'warning' : item.is_recurrent ? 'info' : 'brand'}
                      titulo={item.description || item.category}
                      subtitulo={[nomeImovel(item), item.category, dataCurta(item.expense_date)].filter(Boolean).join(' · ')}
                      valor={formatarMoedaSemCentavos(item.amount)}
                      legenda={st.texto}
                      tomLegenda={st.tom}
                      aoTocar={() => {
                        setSelId(item.id);
                        setAberta(true);
                      }}
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
              onClick={() => setQuantas(mostradas + POR_VEZ)}
              className="min-h-11 w-full rounded-full text-[13px] font-semibold"
            >
              Carregar mais
              <span className="ml-1 font-mono text-xs font-normal tabular-nums text-gray-500">
                ({mostradas} de {lista.length})
              </span>
            </Button>
          )}
        </>
      )}

      <FolhaDetalhes
        aberta={aberta && !!d}
        aoMudar={setAberta}
        titulo={d?.description || d?.category || 'Despesa'}
        subtitulo={d ? [nomeImovel(d), d.category, formatarData(d.expense_date)].filter(Boolean).join(' · ') : undefined}
        acoes={
          d && podeEditar ? (
            <>
              {d.payment_status !== 'Pago' && (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5 rounded-full"
                  onClick={async () => {
                    await aoMarcarPaga(d.id);
                    setAberta(false);
                  }}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {ehReembolsoPendente(d) ? 'Reembolsada' : 'Paga'}
                </Button>
              )}
              {d.is_recurrent && d.recurrence_group_id && (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5 rounded-full"
                  onClick={() => {
                    setAberta(false);
                    aoVerRecorrencia(d.recurrence_group_id as string);
                  }}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Recorrência
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 rounded-full"
                onClick={() => {
                  setAberta(false);
                  aoEditar(d);
                }}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Editar
              </Button>
            </>
          ) : undefined
        }
        excluir={
          d && podeEditar
            ? {
                rotulo: 'Excluir despesa',
                titulo: 'Excluir esta despesa?',
                descricao: d.is_recurrent
                  ? 'Só esta ocorrência sai. As outras da recorrência continuam (veja em Recorrência). Esta ação não pode ser desfeita.'
                  : 'Esta ação não pode ser desfeita.',
                aoConfirmar: async () => {
                  await aoExcluir(d.id);
                  setAberta(false);
                },
              }
            : undefined
        }
      >
        {d && (
          <dl className="grid grid-cols-3 gap-3">
            {[
              { rotulo: 'Valor', valor: formatarMoeda(d.amount), mono: true },
              { rotulo: 'Tipo', valor: ehFixa(d) ? 'Fixa' : 'Variável' },
              { rotulo: 'Situação', valor: situacao(d).texto },
            ].map((kv) => (
              <div key={kv.rotulo} className="min-w-0">
                <dt className="truncate text-xs text-gray-500">{kv.rotulo}</dt>
                <dd className={`truncate text-sm font-semibold text-gray-900 ${kv.mono ? 'font-mono tabular-nums' : ''}`}>{kv.valor}</dd>
              </div>
            ))}
          </dl>
        )}
      </FolhaDetalhes>
    </div>
  );
};

export default DespesasCelular;
