export type AbaCelular = 'pendentes' | 'hoje' | 'concluidas' | 'todas';

/**
 * A aba é guardada numa chave só, para a escolha valer no celular e no
 * computador, que têm abas diferentes. Estas tabelas dizem a aba equivalente
 * em cada versão.
 */
export const ABAS_DE_FAXINAS = [null, 'pendentes', 'hoje', 'concluidas', 'todas', 'all', 'pending', 'completed', 'available', 'stats'];
export const ABA_NO_CELULAR: Record<string, AbaCelular> = {
  pendentes: 'pendentes', hoje: 'hoje', concluidas: 'concluidas', todas: 'todas',
  pending: 'pendentes', completed: 'concluidas', all: 'todas', available: 'pendentes', stats: 'todas',
};
export const ABA_NO_COMPUTADOR: Record<string, string> = {
  all: 'all', pending: 'pending', completed: 'completed', available: 'available', stats: 'stats',
  pendentes: 'pending', concluidas: 'completed', todas: 'all', hoje: 'all',
};
