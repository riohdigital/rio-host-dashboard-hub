/**
 * Abre a gaveta de filtros globais do celular (NavegacaoCelular) de qualquer
 * tela, como o abrirChat() do Chat IA. Usado quando um campo da tela mostra
 * um filtro global (ex.: Imóvel e Período em Relatórios).
 *
 *   abrirFiltros();
 */
const ouvintes = new Set<() => void>();

/** Avisa a NavegacaoCelular para abrir a gaveta de filtros */
export const abrirFiltros = () => ouvintes.forEach((f) => f());

/** A NavegacaoCelular se inscreve aqui; devolve a função de cancelar */
export function aoPedirFiltros(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}
