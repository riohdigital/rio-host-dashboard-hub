import React from 'react';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEhCelular } from '@/hooks/useMidia';
import { cn } from '@/lib/utils';

export interface Coluna<T> {
  chave: string;
  titulo: React.ReactNode;
  celula: (item: T) => React.ReactNode;
  alinhar?: 'esquerda' | 'centro' | 'direita';
  className?: string;
}

interface TabelaResponsivaProps<T> {
  itens: T[];
  chaveItem: (item: T) => string;
  colunas: Coluna<T>[];
  /** Como cada item aparece no celular (abaixo de 768px) */
  cartao: (item: T) => React.ReactNode;
  /** Rodapé da tabela (só no desktop) */
  rodape?: React.ReactNode;
  /** Mostrado quando não há itens */
  vazio?: React.ReactNode;
  aoClicarLinha?: (item: T) => void;
  className?: string;
}

const ALINHAR = { esquerda: 'text-left', centro: 'text-center', direita: 'text-right' };

/** Tabela no desktop; lista de cartões no celular */
function TabelaResponsiva<T>({
  itens,
  chaveItem,
  colunas,
  cartao,
  rodape,
  vazio,
  aoClicarLinha,
  className,
}: TabelaResponsivaProps<T>) {
  const celular = useEhCelular();

  if (itens.length === 0 && vazio) return <>{vazio}</>;

  if (celular) {
    return (
      // grid-cols-1 + min-w-0: um texto comprido no cartão não alarga a página
      <ul className={cn('grid grid-cols-1 gap-3', className)}>
        {itens.map((item) => (
          <li key={chaveItem(item)} className="min-w-0">
            {cartao(item)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            {colunas.map((c) => (
              <TableHead key={c.chave} className={cn('whitespace-nowrap', ALINHAR[c.alinhar ?? 'esquerda'], c.className)}>
                {c.titulo}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((item) => (
            <TableRow
              key={chaveItem(item)}
              className={cn('hover:bg-gray-50', aoClicarLinha && 'cursor-pointer')}
              onClick={aoClicarLinha ? () => aoClicarLinha(item) : undefined}
            >
              {colunas.map((c) => (
                <TableCell key={c.chave} className={cn(ALINHAR[c.alinhar ?? 'esquerda'], c.className)}>
                  {c.celula(item)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {rodape && <TableFooter>{rodape}</TableFooter>}
      </Table>
    </div>
  );
}

export default TabelaResponsiva;
