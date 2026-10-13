/**
 * Lista fechada do que o dashboard pode pedir ao navegador durante o login.
 *
 * O front não executa JavaScript no navegador logado: ele só move o mouse,
 * clica, rola e digita. Cada mensagem vira comandos CDP de entrada (Input.*);
 * qualquer outra coisa é descartada.
 *
 * Digitação: cada caractere vira uma tecla de verdade (keyDown com `text`),
 * que dispara keydown/keypress/input/keyup como um teclado físico. É o que a
 * página da Booking acompanha — preencher o campo por script fazia o
 * formulário enviar a senha vazia.
 */

const TECLAS = {
  Enter: { vk: 13, code: 'Enter', text: '\r' },
  Backspace: { vk: 8, code: 'Backspace' },
  Delete: { vk: 46, code: 'Delete' },
  Tab: { vk: 9, code: 'Tab' },
  Escape: { vk: 27, code: 'Escape' },
  ArrowLeft: { vk: 37, code: 'ArrowLeft' },
  ArrowUp: { vk: 38, code: 'ArrowUp' },
  ArrowRight: { vk: 39, code: 'ArrowRight' },
  ArrowDown: { vk: 40, code: 'ArrowDown' },
  Home: { vk: 36, code: 'Home' },
  End: { vk: 35, code: 'End' },
  PageUp: { vk: 33, code: 'PageUp' },
  PageDown: { vk: 34, code: 'PageDown' },
};

const BOTOES = new Set(['left', 'right', 'middle', 'none']);
const MAX_TEXTO = 512;
const SHIFT = 8;
const CTRL = 2;

const numero = (v, min, max) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
};

/** Tecla de um caractere: keyDown com text gera keypress + input, como digitação real. */
function teclaDeCaractere(ch) {
  return [
    { method: 'Input.dispatchKeyEvent', params: { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch } },
    { method: 'Input.dispatchKeyEvent', params: { type: 'keyUp', key: ch } },
  ];
}

/**
 * Converte uma mensagem do dashboard em comandos CDP.
 * Devolve [] para mensagem inválida ou desconhecida.
 *
 * @param {any} msg
 * @param {{ w: number, h: number }} viewport tamanho da página em px CSS
 */
export function traduzir(msg, viewport) {
  if (!msg || typeof msg !== 'object') return [];

  switch (msg.t) {
    case 'mouse': {
      const tipos = { move: 'mouseMoved', down: 'mousePressed', up: 'mouseReleased' };
      const type = tipos[msg.a];
      const x = numero(msg.x, 0, viewport.w);
      const y = numero(msg.y, 0, viewport.h);
      if (!type || x === null || y === null) return [];
      const button = BOTOES.has(msg.b) ? msg.b : (type === 'mouseMoved' ? 'none' : 'left');
      const clickCount = type === 'mouseMoved' ? 0 : (numero(msg.c, 1, 3) ?? 1);
      return [{ method: 'Input.dispatchMouseEvent', params: { type, x, y, button, clickCount } }];
    }

    case 'wheel': {
      const x = numero(msg.x, 0, viewport.w);
      const y = numero(msg.y, 0, viewport.h);
      const deltaX = numero(msg.dx ?? 0, -3000, 3000);
      const deltaY = numero(msg.dy ?? 0, -3000, 3000);
      if (x === null || y === null || deltaX === null || deltaY === null) return [];
      return [{ method: 'Input.dispatchMouseEvent', params: { type: 'mouseWheel', x, y, deltaX, deltaY } }];
    }

    case 'text': {
      if (typeof msg.v !== 'string' || !msg.v) return [];
      const texto = msg.v.slice(0, MAX_TEXTO).replace(/[\r\n]/g, '');
      if (!texto) return [];
      // Colagem longa vai de uma vez; digitação vai tecla a tecla.
      if (texto.length > 64) return [{ method: 'Input.insertText', params: { text: texto } }];
      return Array.from(texto).flatMap(teclaDeCaractere);
    }

    case 'key': {
      const tecla = TECLAS[msg.k];
      if (!tecla) return [];
      const modifiers = msg.shift === true && ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(msg.k)
        ? SHIFT : 0;
      const base = { key: msg.k, code: tecla.code, windowsVirtualKeyCode: tecla.vk, nativeVirtualKeyCode: tecla.vk, modifiers };
      const down = tecla.text
        ? { type: 'keyDown', ...base, text: tecla.text, unmodifiedText: tecla.text }
        : { type: 'rawKeyDown', ...base };
      return [
        { method: 'Input.dispatchKeyEvent', params: down },
        { method: 'Input.dispatchKeyEvent', params: { type: 'keyUp', ...base } },
      ];
    }

    case 'select_all':
      return [
        { method: 'Input.dispatchKeyEvent', params: { type: 'rawKeyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: CTRL, commands: ['selectAll'] } },
        { method: 'Input.dispatchKeyEvent', params: { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: CTRL } },
      ];

    default:
      return [];
  }
}
