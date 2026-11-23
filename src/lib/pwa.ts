/**
 * Instalação do app (PWA).
 *
 * O Chrome/Android dispara `beforeinstallprompt` uma vez, logo na abertura;
 * por isso o evento é capturado aqui, no carregamento do módulo (importado em
 * main.tsx), e guardado para o botão "Instalar app" usar depois.
 */
import { useSyncExternalStore } from 'react';

interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let eventoGuardado: EventoInstalacao | null = null;
let instalado = false;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

const rodandoInstalado = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoGuardado = e as EventoInstalacao;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    instalado = true;
    eventoGuardado = null;
    avisar();
  });
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', avisar);
}

export const ehIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

type Estado = 'instalado' | 'prompt' | 'ios' | 'indisponivel';

function estadoAtual(): Estado {
  if (instalado || rodandoInstalado()) return 'instalado';
  if (eventoGuardado) return 'prompt';
  if (ehIOS()) return 'ios';
  return 'indisponivel';
}

const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};

/** Estado da instalação: some quando já instalado ou quando o navegador não oferece */
export function useInstalacaoApp() {
  const estado = useSyncExternalStore(assinar, estadoAtual, () => 'indisponivel' as Estado);

  const instalar = async (): Promise<boolean> => {
    if (!eventoGuardado) return false;
    const ev = eventoGuardado;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    eventoGuardado = null;
    if (outcome === 'accepted') instalado = true;
    avisar();
    return outcome === 'accepted';
  };

  return { estado, instalar };
}
