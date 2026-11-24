/**
 * Onde ficam guardadas as escolhas de tela (o que o usuário digita, escolhe ou
 * abre) para voltarem depois de recarregar a página. Parte sem React, usada
 * pelos hooks de `@/hooks/useEstadoPersistente` e por quem grava fora de um
 * componente (rolagem, rascunhos, sair da conta).
 *
 * - `sessao` = sessionStorage (volta ao recarregar, zera ao fechar o app);
 *   `aparelho` = localStorage (filtros globais).
 * - Toda chave leva o id do usuário: `riohhost:v1:<usuário>:<chave>`.
 * - Tudo tolera storage indisponível ou JSON corrompido (vale o padrão).
 */

export type Area = 'sessao' | 'aparelho';

const PREFIXO = 'riohhost:v1:';
export const ANONIMO = 'anon';
export const AUSENTE = Symbol('ausente');

/** Valores já lidos, por área e chave completa. */
const memoria: Record<Area, Map<string, unknown>> = { sessao: new Map(), aparelho: new Map() };
export const ouvintes = new Map<string, Set<() => void>>();

const storageDa = (area: Area): Storage | null => {
  try {
    if (typeof window === 'undefined') return null;
    return area === 'aparelho' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

export const chaveCompleta = (usuario: string | null | undefined, chave: string) =>
  `${PREFIXO}${usuario || ANONIMO}:${chave}`;

export function lerBruto(area: Area, completa: string): unknown {
  const cache = memoria[area];
  if (cache.has(completa)) return cache.get(completa);
  let valor: unknown = AUSENTE;
  try {
    const texto = storageDa(area)?.getItem(completa);
    if (texto != null) valor = JSON.parse(texto);
  } catch {
    valor = AUSENTE;
  }
  cache.set(completa, valor);
  return valor;
}

export function gravarBruto(area: Area, completa: string, valor: unknown) {
  memoria[area].set(completa, valor);
  try {
    const storage = storageDa(area);
    if (valor === AUSENTE || valor === undefined) storage?.removeItem(completa);
    else storage?.setItem(completa, JSON.stringify(valor));
  } catch {
    // Storage cheio ou bloqueado (aba anônima): a escolha vale só nesta visita.
  }
  ouvintes.get(`${area}|${completa}`)?.forEach((avisar) => avisar());
}

/** Lê fora do React (rolagem, rascunhos). Devolve `undefined` se não houver nada guardado. */
export function lerEscolha(usuario: string | null | undefined, chave: string, area: Area = 'sessao'): unknown {
  const bruto = lerBruto(area, chaveCompleta(usuario, chave));
  return bruto === AUSENTE ? undefined : bruto;
}

/** Grava fora do React. `undefined` apaga. */
export function gravarEscolha(usuario: string | null | undefined, chave: string, valor: unknown, area: Area = 'sessao') {
  gravarBruto(area, chaveCompleta(usuario, chave), valor === undefined ? AUSENTE : valor);
}

/**
 * Apaga tudo o que o usuário tem guardado na sessão começando por `prefixo`
 * (ex.: o rascunho de um formulário e os estados auxiliares dele).
 *
 * `soNoStorage`: tira do storage mas deixa o valor na tela (quem está montado
 * não é avisado). Serve ao formulário que acabou de salvar e ainda aparece
 * enquanto a janela fecha; a limpeza completa vem em seguida.
 */
export function apagarEscolhas(usuario: string | null | undefined, prefixo: string, soNoStorage = false) {
  const inicio = chaveCompleta(usuario, prefixo);
  if (soNoStorage) {
    try {
      const storage = storageDa('sessao');
      if (!storage) return;
      const achadas: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const chave = storage.key(i);
        if (chave?.startsWith(inicio)) achadas.push(chave);
      }
      achadas.forEach((chave) => storage.removeItem(chave));
    } catch {
      // Sem storage não há o que tirar.
    }
    return;
  }
  const chaves = new Set<string>();
  memoria.sessao.forEach((_, chave) => {
    if (chave.startsWith(inicio)) chaves.add(chave);
  });
  try {
    const storage = storageDa('sessao');
    if (storage) {
      for (let i = 0; i < storage.length; i++) {
        const chave = storage.key(i);
        if (chave?.startsWith(inicio)) chaves.add(chave);
      }
    }
  } catch {
    // Sem storage, só a memória é limpa.
  }
  chaves.forEach((chave) => gravarBruto('sessao', chave, AUSENTE));
}

/**
 * Apaga as escolhas de tela guardadas na sessão (de qualquer conta). Chamado
 * ao sair: quem entrar depois no mesmo aparelho não encontra nem o que foi
 * digitado. Os filtros globais (localStorage, por usuário) ficam.
 */
export function limparEscolhasDaSessao() {
  memoria.sessao.clear();
  try {
    const storage = storageDa('sessao');
    if (!storage) return;
    const chaves: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const chave = storage.key(i);
      if (chave?.startsWith(PREFIXO)) chaves.push(chave);
    }
    chaves.forEach((chave) => storage.removeItem(chave));
  } catch {
    // Sem storage não há o que limpar.
  }
}
