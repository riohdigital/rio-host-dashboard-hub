/**
 * Investimentos & ROI no celular (abaixo de 1024px, T10 do plano).
 *
 * - PorImovelCelular: "Por imóvel" em linhas, com o ROI em destaque à direita
 *   (no lugar da tabela "Resumo por Propriedade", que era cortada).
 * - HistoricoInvestimentosCelular: os lançamentos em linhas; tocar abre a
 *   folha com os detalhes e o excluir (com confirmação). Na tela geral fica
 *   recolhido; na tela de um imóvel é o conteúdo principal.
 *
 * Só apresentação: os números chegam prontos (useROICalculations e
 * usePropertyInvestments); nada é recalculado aqui.
 */
import React from 'react';
import { Building2, Receipt } from 'lucide-react';
import Bloco from '@/components/comum/Bloco';
import BlocoRecolhivel from '@/components/comum/BlocoRecolhivel';
import LinhaLista from '@/components/comum/LinhaLista';
import { ListaLinhas } from '@/components/comum/GrupoLista';
import FolhaDetalhes from '@/components/comum/FolhaDetalhes';
import VerTodos from '@/components/comum/VerTodos';
import { useListaCurta } from '@/components/comum/useListaCurta';
import { formatarData, formatarMoeda, formatarMoedaSemCentavos } from '@/components/comum/formatos';
import type { PropertyInvestment, PropertyROI } from '@/types/investment';
import { AJUDA_ROI_IMOVEL } from './carteira';
import { useItemAberto } from '@/hooks/useItemAberto';

export const percentualROI = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/* ── Por imóvel ──────────────────────────────────────────── */

interface PorImovelProps {
  roiData: PropertyROI[];
  /** Tocar na linha abre a tela do imóvel (quem pode lançar investimentos) */
  podeGerenciar: boolean;
}

export const PorImovelCelular = ({ roiData, podeGerenciar }: PorImovelProps) => (
  <Bloco titulo="Por imóvel" extra="ROI" ajuda={AJUDA_ROI_IMOVEL} compacto>
    {roiData.length === 0 ? (
      <p className="py-3 text-sm text-gray-500">Adicione investimentos aos imóveis para ver o retorno de cada um aqui.</p>
    ) : (
      <ListaLinhas>
        {roiData.map((roi) => (
          <LinhaLista
            key={roi.property_id}
            icone={Building2}
            tomIcone={roi.is_profitable ? 'success' : 'warning'}
            titulo={roi.property_nickname || roi.property_name}
            subtitulo={
              // Duas linhas curtas: numa só, a receita era cortada com reticências
              <>
                <span className="block truncate">Investido {formatarMoedaSemCentavos(roi.total_investment)}</span>
                <span className="block truncate">Receita líq. {formatarMoedaSemCentavos(roi.total_revenue)}</span>
              </>
            }
            valor={percentualROI(roi.roi_percentage)}
            legenda={roi.is_profitable ? 'Lucrativo' : 'A recuperar'}
            tomLegenda={roi.is_profitable ? 'success' : 'warning'}
            para={podeGerenciar ? `/investimentos/${roi.property_id}` : undefined}
          />
        ))}
      </ListaLinhas>
    )}
  </Bloco>
);

/* ── Histórico ───────────────────────────────────────────── */

interface HistoricoProps {
  investments: PropertyInvestment[];
  onDelete: (id: string) => Promise<void>;
  podeExcluir: boolean;
  /** Mostra o imóvel em cada linha (tela geral) */
  mostrarImovel?: boolean;
  /** Tela geral: o bloco começa fechado */
  recolhido?: boolean;
  loading?: boolean;
}

export const HistoricoInvestimentosCelular = ({
  investments,
  onDelete,
  podeExcluir,
  mostrarImovel = true,
  recolhido = false,
  loading,
}: HistoricoProps) => {
  // "Ver todos", o bloco aberto e a folha do lançamento voltam depois de recarregar
  const onde = recolhido ? 'investimentos.geral' : 'investimentos.imovel';
  const folha = useItemAberto(`${onde}.folha`, investments, { carregando: !!loading });
  const aberto = folha.aberto ? folha.item : null;
  const setAberto = (inv: PropertyInvestment | null) => (inv ? folha.abrir(inv) : folha.limpar());
  const lista = useListaCurta(investments, recolhido ? 5 : 10, { chave: `${onde}.historico.todos` });
  const total = investments.reduce((soma, inv) => soma + Number(inv.amount), 0);
  const titulo = 'Histórico de investimentos';
  const resumo = `${investments.length} ${investments.length === 1 ? 'lançamento' : 'lançamentos'} · ${formatarMoedaSemCentavos(total)}`;

  const imovelDe = (inv: PropertyInvestment) => inv.property?.nickname || inv.property?.name;

  const linhas = loading ? (
    <p className="py-3 text-sm text-gray-500">Carregando investimentos…</p>
  ) : investments.length === 0 ? (
    <p className="py-3 text-sm text-gray-500">Nenhum investimento registrado ainda.</p>
  ) : (
    <>
      <ListaLinhas>
        {lista.visiveis.map((inv) => (
          <LinhaLista
            key={inv.id}
            icone={Receipt}
            tomIcone="neutro"
            titulo={inv.description}
            subtitulo={[inv.category?.name, mostrarImovel ? imovelDe(inv) : null, formatarData(inv.investment_date)].filter(Boolean).join(' · ')}
            valor={formatarMoeda(Number(inv.amount))}
            aoTocar={() => setAberto(inv)}
          />
        ))}
      </ListaLinhas>
      {lista.temMais && <VerTodos total={lista.total} expandido={lista.expandido} aoClicar={lista.alternar} />}
    </>
  );

  return (
    <>
      {recolhido ? (
        <BlocoRecolhivel chave={`${onde}.historico.aberto`} titulo={titulo} resumo={resumo}>
          {linhas}
        </BlocoRecolhivel>
      ) : (
        <Bloco titulo={titulo} extra={investments.length ? formatarMoedaSemCentavos(total) : undefined} compacto>
          {linhas}
        </Bloco>
      )}

      <FolhaDetalhes
        aberta={!!aberto}
        aoMudar={(v) => !v && setAberto(null)}
        titulo={aberto?.description ?? ''}
        subtitulo={aberto ? [aberto.category?.name, formatarData(aberto.investment_date)].filter(Boolean).join(' · ') : undefined}
        excluir={
          podeExcluir && aberto
            ? {
                rotulo: 'Excluir investimento',
                titulo: 'Excluir este investimento?',
                aoConfirmar: async () => {
                  await onDelete(aberto.id);
                  setAberto(null);
                },
              }
            : undefined
        }
      >
        {aberto && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div className="min-w-0">
              <dt className="text-xs text-gray-500">Valor</dt>
              <dd className="font-mono font-semibold tabular-nums text-gray-900">{formatarMoeda(Number(aberto.amount))}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-gray-500">Data</dt>
              <dd className="font-mono tabular-nums text-gray-900">{formatarData(aberto.investment_date)}</dd>
            </div>
            {imovelDe(aberto) && (
              <div className="min-w-0">
                <dt className="text-xs text-gray-500">Imóvel</dt>
                <dd className="truncate text-gray-900">{imovelDe(aberto)}</dd>
              </div>
            )}
            <div className="min-w-0">
              <dt className="text-xs text-gray-500">Categoria</dt>
              <dd className="truncate text-gray-900">{aberto.category?.name || 'Sem categoria'}</dd>
            </div>
            {aberto.notes && (
              <div className="col-span-2 min-w-0">
                <dt className="text-xs text-gray-500">Observações</dt>
                <dd className="whitespace-pre-line text-gray-700">{aberto.notes}</dd>
              </div>
            )}
          </dl>
        )}
      </FolhaDetalhes>
    </>
  );
};
