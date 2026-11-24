import { useCallback, useEffect, useMemo } from 'react';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';

/**
 * Folha, janela ou gaveta que volta aberta depois de recarregar a página,
 * mostrando o mesmo item.
 *
 *   const folha = useItemAberto('despesas.folha', despesas, { carregando });
 *   <LinhaLista aoTocar={() => folha.abrir(despesa)} />
 *   <FolhaDetalhes aberta={folha.aberto} aoMudar={folha.mudar}>{folha.item && …}</FolhaDetalhes>
 *
 * Guarda só o id (nunca o registro): ao recarregar, o item é procurado de
 * novo na lista carregada, com os dados atuais. `abrir(null)` abre sem item
 * (formulário de cadastro novo). Se o item guardado não existir mais quando a
 * lista terminar de carregar, a folha fica fechada.
 *
 * Ao fechar, o id é mantido (o conteúdo continua na tela durante a animação
 * de saída); `aberto` é que diz se está à mostra.
 */

interface Guardado {
  aberto: boolean;
  id: string | null;
}

const FECHADO: Guardado = { aberto: false, id: null };
const ehGuardado = (v: unknown) => {
  const g = v as Partial<Guardado> | null;
  return !!g && typeof g === 'object' && typeof g.aberto === 'boolean' && (g.id === null || typeof g.id === 'string');
};

interface Opcoes<T> {
  /** Como achar o id do item (padrão: `item.id`). */
  idDe?: (item: T) => string | null | undefined;
  /** A lista ainda está carregando: não conclua que o item sumiu. */
  carregando?: boolean;
}

const idPadrao = (item: unknown) => (item as { id?: string | null })?.id;

export function useItemAberto<T>(chave: string, itens: readonly T[] | null | undefined, opcoes: Opcoes<T> = {}) {
  const { idDe = idPadrao, carregando = false } = opcoes;
  const [guardado, setGuardado] = useEstadoPersistente<Guardado>(chave, FECHADO, { aceita: ehGuardado });

  const item = useMemo(
    () => (guardado.id === null ? null : (itens ?? []).find((i) => idDe(i) === guardado.id) ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idDe costuma ser uma função nova a cada render
    [guardado.id, itens],
  );

  const sumiu = guardado.aberto && guardado.id !== null && item === null && !carregando;
  useEffect(() => {
    if (sumiu) setGuardado(FECHADO);
  }, [sumiu, setGuardado]);

  const abrir = useCallback(
    (alvo: T | string | null = null) => {
      const id = alvo === null ? null : typeof alvo === 'string' ? alvo : idDe(alvo) ?? null;
      setGuardado({ aberto: true, id });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idem
    [setGuardado],
  );
  const fechar = useCallback(() => setGuardado((g) => (g.aberto ? { ...g, aberto: false } : g)), [setGuardado]);
  const mudar = useCallback((aberto: boolean) => setGuardado((g) => (g.aberto === aberto ? g : { ...g, aberto })), [setGuardado]);
  /** Fecha e esquece o item (para formulários: a próxima abertura começa do zero). */
  const limpar = useCallback(() => setGuardado(FECHADO), [setGuardado]);

  return {
    /** Está à mostra (e, se aponta para um item, ele foi encontrado). */
    aberto: guardado.aberto && (guardado.id === null || item !== null),
    item,
    id: guardado.id,
    abrir,
    fechar,
    mudar,
    limpar,
  };
}
