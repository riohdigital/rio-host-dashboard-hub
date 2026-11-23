/**
 * Controle do Chat IA fora do componente: abre/fecha a conversa e guarda o
 * número de respostas não lidas. Assim o botão do centro da barra de baixo
 * (NavegacaoCelular) e o botão flutuante do computador (AIChat) mexem no
 * mesmo estado.
 *
 *   abrirChat();                 // de qualquer lugar
 *   const aberto = useChatAberto();
 *   const naoLidas = useNaoLidasChat();
 */
import { useSyncExternalStore } from 'react';

let aberto = false;
let naoLidas = 0;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};

export const chatEstaAberto = () => aberto;

export function definirChatAberto(valor: boolean) {
  if (valor === aberto) return;
  aberto = valor;
  if (valor) naoLidas = 0; // abrir a conversa conta como leitura
  avisar();
}

export const abrirChat = () => definirChatAberto(true);
export const fecharChat = () => definirChatAberto(false);
export const alternarChat = () => definirChatAberto(!aberto);

/** Soma uma resposta não lida (só conta com a conversa fechada) */
export function contarNaoLida() {
  if (aberto) return;
  naoLidas += 1;
  avisar();
}

export const useChatAberto = () => useSyncExternalStore(assinar, () => aberto, () => false);
export const useNaoLidasChat = () => useSyncExternalStore(assinar, () => naoLidas, () => 0);
