import { useCallback, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ANONIMO, AUSENTE, chaveCompleta, gravarBruto, lerBruto, ouvintes, type Area } from '@/lib/escolhasGuardadas';

export { apagarEscolhas, gravarEscolha, lerEscolha, limparEscolhasDaSessao } from '@/lib/escolhasGuardadas';

/**
 * `useState` que sobrevive ao recarregar a página.
 *
 *   const [busca, setBusca] = useEstadoPersistente('reservas.busca', '');
 *   const [aba, setAba] = useEstadoPersistente('reservas.aba', 'cashflow', { aceita: ['cashflow', 'active'] });
 *
 * Use para tudo o que o usuário digita, escolhe ou abre numa tela: busca,
 * filtro, aba, seletor, mês local, "carregar mais", bloco recolhido, folha ou
 * janela aberta. Peças irmãs: `useEstadoDoRecorte` (vale enquanto outra
 * escolha for a mesma), `useItemAberto` (folha/janela com o item que mostra) e
 * `useRascunho`/`useRascunhoFormulario` (formulários).
 *
 * NUNCA use para senha, código de autenticação, token ou link com segredo:
 * esses ficam em `useState` e somem ao recarregar, de propósito.
 *
 * - Guarda em `sessionStorage` (volta ao recarregar, zera ao fechar o app).
 *   `onde: 'aparelho'` guarda em `localStorage` (filtros globais).
 * - A chave leva o id do usuário logado: outra conta no mesmo aparelho nunca
 *   herda as escolhas. Sem usuário (tela de login) a chave é anônima.
 * - Duas peças com a mesma chave (a versão de celular e a de computador de
 *   uma tela) enxergam e mudam o mesmo valor.
 * - Storage indisponível, JSON corrompido ou valor que `aceita` recusa: usa o
 *   valor inicial, sem erro.
 * - `chave` nula desliga a persistência (vira um `useState` comum): serve às
 *   peças reutilizáveis em que guardar é opcional.
 */

export interface OpcoesEstadoPersistente<T> {
  /** 'sessao' (padrão) = sessionStorage; 'aparelho' = localStorage. */
  onde?: Area;
  /**
   * Quais valores guardados ainda valem: uma lista (abas, opções fixas) ou
   * uma função. Sem isso, basta o valor ter o mesmo tipo do inicial.
   */
  aceita?: readonly T[] | ((valor: unknown) => boolean);
}

const mesmoTipo = (valor: unknown, inicial: unknown) => {
  if (inicial === null || inicial === undefined) {
    return valor === null || ['string', 'number', 'boolean'].includes(typeof valor);
  }
  if (Array.isArray(inicial)) return Array.isArray(valor);
  if (typeof inicial === 'number') return typeof valor === 'number' && Number.isFinite(valor);
  if (typeof inicial === 'object') return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
  return typeof valor === typeof inicial;
};

export function useEstadoPersistente<T>(
  chave: string | null,
  inicial: T | (() => T),
  opcoes: OpcoesEstadoPersistente<T> = {},
): [T, Dispatch<SetStateAction<T>>] {
  const { user } = useAuth();
  const area: Area = opcoes.onde ?? 'sessao';
  // Sem chave nada é lido nem gravado; a chave vazia só mantém a ordem dos hooks.
  const completa = chaveCompleta(user?.id, chave ?? '');

  // O valor inicial é calculado uma vez, como no useState.
  const inicialRef = useRef<{ valor: T } | null>(null);
  if (inicialRef.current === null) {
    inicialRef.current = { valor: typeof inicial === 'function' ? (inicial as () => T)() : inicial };
  }
  const valorInicial = inicialRef.current.valor;
  const local = useState<T>(valorInicial);

  const aceitaRef = useRef(opcoes.aceita);
  aceitaRef.current = opcoes.aceita;

  const resolver = useCallback(
    (bruto: unknown): T => {
      if (bruto === AUSENTE) return valorInicial;
      const aceita = aceitaRef.current;
      const vale =
        typeof aceita === 'function'
          ? aceita(bruto)
          : Array.isArray(aceita)
            ? aceita.includes(bruto as T)
            : mesmoTipo(bruto, valorInicial);
      return vale ? (bruto as T) : valorInicial;
    },
    [valorInicial],
  );

  const assinar = useCallback(
    (avisar: () => void) => {
      const id = `${area}|${completa}`;
      let grupo = ouvintes.get(id);
      if (!grupo) {
        grupo = new Set();
        ouvintes.set(id, grupo);
      }
      grupo.add(avisar);
      return () => {
        grupo.delete(avisar);
        if (grupo.size === 0) ouvintes.delete(id);
      };
    },
    [area, completa],
  );

  const bruto = useSyncExternalStore(
    assinar,
    () => lerBruto(area, completa),
    () => AUSENTE as unknown,
  );
  const valor = useMemo(() => resolver(bruto), [resolver, bruto]);

  const definir = useCallback<Dispatch<SetStateAction<T>>>(
    (novo) => {
      const atual = resolver(lerBruto(area, completa));
      const proximo = typeof novo === 'function' ? (novo as (anterior: T) => T)(atual) : novo;
      if (Object.is(proximo, atual)) return;
      gravarBruto(area, completa, proximo);
    },
    [area, completa, resolver],
  );

  return chave === null ? local : [valor, definir];
}

/** O id que entra nas chaves: o do usuário logado, ou "anon" na tela de login. */
export const useDonoDasEscolhas = () => useAuth().user?.id ?? ANONIMO;

/**
 * Estado que só vale enquanto o `recorte` for o mesmo.
 *
 *   const [dia, setDia] = useEstadoDoRecorte('calendario.mes.dia', periodo, null);
 *
 * Serve ao que depende de outra escolha: o dia selecionado dentro de um
 * período, a quantidade carregada de uma lista filtrada. Recarregou a página
 * no mesmo recorte, o valor volta; mudou o recorte (outro período, outra
 * busca), recomeça do inicial.
 */
export function useEstadoDoRecorte<T>(
  chave: string,
  recorte: string,
  inicial: T | (() => T),
  aceita?: (valor: unknown) => boolean,
): [T, Dispatch<SetStateAction<T>>] {
  const inicialRef = useRef(inicial);
  inicialRef.current = inicial;
  // O inicial é calculado uma vez por recorte, como o useState faria ao remontar.
  const padrao = useMemo<T>(() => {
    const atual = inicialRef.current;
    return typeof atual === 'function' ? (atual as () => T)() : atual;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcula só quando o recorte muda
  }, [recorte]);
  const aceitaRef = useRef(aceita);
  aceitaRef.current = aceita;

  const [guardado, setGuardado] = useEstadoPersistente<{ recorte: string; valor: T } | null>(chave, null, {
    aceita: (v) => {
      if (v === null) return true;
      const g = v as { recorte?: unknown; valor?: unknown };
      return typeof g === 'object' && typeof g.recorte === 'string' && 'valor' in g;
    },
  });

  const vale = guardado !== null && guardado.recorte === recorte && (aceitaRef.current ? aceitaRef.current(guardado.valor) : mesmoTipo(guardado.valor, padrao));
  const valor = vale ? guardado.valor : padrao;

  const definir = useCallback<Dispatch<SetStateAction<T>>>(
    (novo) =>
      setGuardado((anterior) => {
        const serve =
          anterior !== null &&
          anterior.recorte === recorte &&
          (aceitaRef.current ? aceitaRef.current(anterior.valor) : mesmoTipo(anterior.valor, padrao));
        const atual = serve ? anterior.valor : padrao;
        const proximo = typeof novo === 'function' ? (novo as (a: T) => T)(atual) : novo;
        return serve && Object.is(proximo, atual) ? anterior : { recorte, valor: proximo };
      }),
    [setGuardado, recorte, padrao],
  );

  return [valor, definir];
}

/**
 * "Carregar mais" que volta depois de recarregar.
 *
 *   const [quantas, setQuantas] = useQuantasPersistente('reservas.quantas', `${aba}|${busca}`, 30);
 *
 * `recorte` identifica a lista (aba + busca + filtros). Enquanto o recorte for
 * o mesmo, a quantidade carregada é lembrada; mudou o recorte, volta ao começo.
 */
export function useQuantasPersistente(chave: string, recorte: string, porVez: number) {
  return useEstadoDoRecorte<number>(chave, recorte, porVez, (v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
}

/**
 * Resumo curto de um valor, para usar como `recorte` quando o estado depende
 * de um registro inteiro (ex.: o rascunho vale enquanto os dados salvos forem
 * os mesmos) sem copiar o registro para a chave.
 */
export function resumoDe(valor: unknown): string {
  const texto = JSON.stringify(valor) ?? '';
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  return `${texto.length}.${(h >>> 0).toString(36)}`;
}
