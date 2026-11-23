/** Classes reutilizadas entre telas */

/** Lista de abas que rola de lado no celular em vez de espremer os rótulos */
export const ABAS_ROLAVEIS = 'no-scrollbar flex h-auto w-full justify-start overflow-x-auto [&>button]:min-h-9 [&>button]:shrink-0';

/** Valores (R$, datas, contagens) em fonte mono com dígitos alinhados */
export const NUMERO = 'font-mono tabular-nums';

/**
 * DialogContent que vira folha de baixo no celular (sem trocar o componente):
 * colado embaixo, cantos de cima arredondados, rolagem própria.
 */
export const FOLHA_NO_CELULAR =
  'max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-h-[92dvh] max-sm:overflow-y-auto max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom';
