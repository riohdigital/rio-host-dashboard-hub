/**
 * AbasRolaveis — barra de abas que nunca passa da largura da tela (regra 11).
 * Abaixo de 1024px: até 3 abas dividem a largura (controle segmentado, sem
 * ícone); com 4 ou mais, viram pílulas numa faixa que rola de lado sem
 * empurrar a página (`.m-tabs` do plano). No computador fica a barra de
 * abas de sempre (cinza, na largura toda).
 *
 * Dentro de um <Tabs> (com TabsContent):
 *   <Tabs value={aba} onValueChange={setAba}>
 *     <AbasRolaveis itens={[{ valor: 'todas', rotulo: 'Todas', contagem: 60 }, …]} />
 *     <TabsContent value="todas">…</TabsContent>
 *   </Tabs>
 *
 * Sozinha, como filtro (sem TabsContent): passe `valor` e `aoMudar`.
 *   <AbasRolaveis valor={f} aoMudar={setF} itens={…} />
 *
 * `sangrar`: a faixa rolante encosta nas bordas da tela (use só quando a
 * barra está direto na página, com a margem de 16px do MainLayout).
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface ItemAba {
  valor: string;
  rotulo: React.ReactNode;
  /** Rótulo menor para o celular (ex.: "A receber" em vez de "A receber no período") */
  curto?: React.ReactNode;
  /** Número ao lado do rótulo (mono) */
  contagem?: React.ReactNode;
  /** Ícone (só no computador, ou no celular quando há 4+ abas) */
  icone?: LucideIcon;
  /** Conteúdo extra só no computador (ex.: um ícone de ajuda com tooltip) */
  extra?: React.ReactNode;
  desabilitada?: boolean;
  /** Classes extras da aba (ex.: cor do item ativo no computador) */
  className?: string;
}

interface AbasRolaveisProps {
  itens: ItemAba[];
  /** Modo sozinho: valor atual */
  valor?: string;
  /** Modo sozinho: troca de aba */
  aoMudar?: (valor: string) => void;
  /** Nome da barra para leitor de tela */
  rotulo?: string;
  sangrar?: boolean;
  className?: string;
}

const AbasRolaveis = ({ itens, valor, aoMudar, rotulo, sangrar, className }: AbasRolaveisProps) => {
  const dividir = itens.length <= 3;

  const lista = (
    <TabsList
      aria-label={rotulo}
      className={cn(
        // Computador: a barra de abas de sempre, na largura toda, rolando de lado se precisar
        'no-scrollbar lg:flex lg:h-auto lg:w-full lg:justify-start lg:overflow-x-auto lg:[&>button]:min-h-9 lg:[&>button]:shrink-0',
        dividir
          ? 'max-lg:grid max-lg:h-auto max-lg:w-full max-lg:auto-cols-auto max-lg:grid-flow-col max-lg:justify-stretch max-lg:rounded-full max-lg:bg-gray-100 max-lg:p-[3px]'
          : cn(
              'max-lg:flex max-lg:h-auto max-lg:w-auto max-lg:justify-start max-lg:gap-2 max-lg:overflow-x-auto max-lg:rounded-none max-lg:bg-transparent max-lg:p-0 max-lg:py-0.5',
              sangrar ? 'max-lg:-mx-4 max-lg:px-4 max-lg:[scroll-padding-inline:16px]' : 'max-lg:w-full',
            ),
        className,
      )}
    >
      {itens.map((item) => (
        <TabsTrigger
          key={item.valor}
          value={item.valor}
          disabled={item.desabilitada}
          // A aba tocada entra inteira na faixa
          onClick={(e) => e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })}
          className={cn(
            'gap-1.5 focus-visible:ring-brand',
            dividir
              ? 'max-lg:min-h-9 max-lg:min-w-0 max-lg:rounded-full max-lg:px-2 max-lg:text-[13px] max-lg:font-semibold max-lg:text-gray-500 max-lg:data-[state=active]:text-gray-900 max-lg:data-[state=active]:shadow-sm'
              : 'max-lg:min-h-9 max-lg:shrink-0 max-lg:rounded-full max-lg:border max-lg:border-gray-200 max-lg:bg-card max-lg:px-3.5 max-lg:text-[13px] max-lg:font-semibold max-lg:text-gray-700 max-lg:data-[state=active]:border-brand max-lg:data-[state=active]:bg-brand max-lg:data-[state=active]:text-white max-lg:data-[state=active]:shadow-none',
            item.className,
          )}
        >
          {item.icone && <item.icone className={cn('h-4 w-4 shrink-0', dividir && 'max-lg:hidden')} aria-hidden="true" />}
          {item.curto ? (
            <>
              <span className={cn('lg:hidden', dividir && 'truncate')}>{item.curto}</span>
              <span className="hidden lg:inline">{item.rotulo}</span>
            </>
          ) : (
            <span className={cn(dividir && 'truncate')}>{item.rotulo}</span>
          )}
          {item.extra && <span className="hidden lg:contents">{item.extra}</span>}
          {item.contagem !== undefined && item.contagem !== null && (
            <span className="shrink-0 font-mono text-[11px] font-medium tabular-nums opacity-75 lg:rounded-full lg:bg-gray-200/70 lg:px-1.5 lg:text-xs lg:opacity-100">{item.contagem}</span>
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  );

  if (aoMudar) {
    return (
      <Tabs value={valor} onValueChange={aoMudar}>
        {lista}
      </Tabs>
    );
  }
  return lista;
};

export default AbasRolaveis;
