import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { gravarEscolha, lerEscolha, useDonoDasEscolhas } from '@/hooks/useEstadoPersistente';

/**
 * Guarda a posição de rolagem de cada página (na sessão, por usuário) e
 * volta a ela quando a página é recarregada. Trocar de tela pelo menu não
 * mexe na rolagem: só o recarregar restaura.
 *
 * As telas carregam os dados depois de montar, então a volta é tentada até a
 * página ter altura para chegar lá (ou por alguns segundos). Se a pessoa rolar
 * ou tocar nesse meio-tempo, a tentativa para.
 */

const TENTAR_POR_MS = 6000;
const chaveDa = (caminho: string) => `rolagem.${caminho}`;

/** Com uma gaveta aberta o Safari prende a página (position: fixed); a posição real fica no `top`. */
const posicaoAtual = () => {
  const corpo = document.body.style;
  if (corpo.position === 'fixed') {
    const presa = Math.abs(parseInt(corpo.top || '0', 10));
    if (Number.isFinite(presa) && presa > 0) return presa;
  }
  return Math.round(window.scrollY);
};

// A restauração só acontece uma vez por carregamento da página
let jaRestaurou = false;

const LembrarRolagem = () => {
  const { pathname } = useLocation();
  const dono = useDonoDasEscolhas();

  // O navegador tenta voltar sozinho antes de os dados chegarem; assumimos a tarefa
  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return;
    const anterior = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = anterior;
    };
  }, []);

  // Volta à posição guardada, só no primeiro carregamento
  useEffect(() => {
    if (jaRestaurou) return;
    jaRestaurou = true;
    const alvo = Number(lerEscolha(dono, chaveDa(pathname)));
    if (!Number.isFinite(alvo) || alvo <= 0) return;

    const limite = Date.now() + TENTAR_POR_MS;
    let quadro = 0;
    let parado = false;
    const parar = () => {
      parado = true;
      cancelAnimationFrame(quadro);
      window.removeEventListener('wheel', parar);
      window.removeEventListener('touchstart', parar);
      window.removeEventListener('keydown', parar);
      window.removeEventListener('pointerdown', parar);
    };
    const tentar = () => {
      if (parado) return;
      const maximo = document.documentElement.scrollHeight - window.innerHeight;
      if (maximo >= alvo) {
        window.scrollTo(0, alvo);
        // Mais uma olhada: o conteúdo ainda pode crescer e empurrar a página
        if (Math.abs(window.scrollY - alvo) < 2 && Date.now() > limite - TENTAR_POR_MS + 600) return parar();
      }
      if (Date.now() > limite) {
        window.scrollTo(0, Math.min(alvo, Math.max(0, maximo)));
        return parar();
      }
      quadro = requestAnimationFrame(tentar);
    };
    window.addEventListener('wheel', parar, { passive: true });
    window.addEventListener('touchstart', parar, { passive: true });
    window.addEventListener('keydown', parar);
    window.addEventListener('pointerdown', parar);
    quadro = requestAnimationFrame(tentar);
    return parar;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só no primeiro carregamento
  }, []);

  // Guarda a posição enquanto a pessoa rola
  useEffect(() => {
    let relogio: ReturnType<typeof setTimeout> | null = null;
    const gravar = () => {
      relogio = null;
      gravarEscolha(dono, chaveDa(pathname), posicaoAtual());
    };
    const aoRolar = () => {
      if (relogio === null) relogio = setTimeout(gravar, 150);
    };
    const aoSair = () => {
      if (relogio !== null) {
        clearTimeout(relogio);
        gravar();
      }
    };
    window.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('pagehide', aoSair);
    return () => {
      window.removeEventListener('scroll', aoRolar);
      window.removeEventListener('pagehide', aoSair);
      if (relogio !== null) clearTimeout(relogio);
    };
  }, [dono, pathname]);

  return null;
};

export default LembrarRolagem;
