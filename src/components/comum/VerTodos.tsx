/**
 * VerTodos — o "Ver todos" no pé de um bloco (`.m-more` do plano). Anda junto
 * com `useListaCurta` (./useListaCurta.ts), que corta a lista em N itens
 * (regra 5: blocos mostram de 3 a 5 itens; regra 6: nada rola dentro da página).
 *
 *   const lista = useListaCurta(reservas, 5);
 *   {lista.visiveis.map(…)}
 *   {lista.temMais && <VerTodos total={lista.total} expandido={lista.expandido} aoClicar={lista.alternar} />}
 *
 * Ou leva a outra tela: <VerTodos rotulo="Ver todas as reservas" para="/reservas" />.
 * Com `{ soCompacto: true }` o corte só vale abaixo de 1024px (o computador
 * continua vendo tudo).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface VerTodosProps {
  /** Texto do botão; padrão "Ver todos" ou "Ver todos (N)" */
  rotulo?: React.ReactNode;
  /** Total de itens, mostrado entre parênteses no rótulo padrão */
  total?: number;
  /** Lista já aberta: o botão vira "Mostrar menos" */
  expandido?: boolean;
  aoClicar?: () => void;
  /** Leva a outra tela em vez de abrir a lista */
  para?: string;
  /** Sem o fio de cima (quando não há linhas antes) */
  semFio?: boolean;
  className?: string;
}

const VerTodos = ({ rotulo, total, expandido, aoClicar, para, semFio, className }: VerTodosProps) => {
  const texto = expandido ? 'Mostrar menos' : rotulo ?? (total !== undefined ? `Ver todos (${total})` : 'Ver todos');
  const classe = cn(
    'flex min-h-11 w-full items-center justify-center text-[13px] font-semibold text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-b-2xl',
    !semFio && 'border-t border-gray-100',
    className,
  );
  if (para) {
    return (
      <Link to={para} className={classe}>
        {texto}
      </Link>
    );
  }
  return (
    <button type="button" onClick={aoClicar} aria-expanded={expandido} className={classe}>
      {texto}
    </button>
  );
};

export default VerTodos;
