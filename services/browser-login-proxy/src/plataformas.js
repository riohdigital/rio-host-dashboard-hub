/**
 * Plataformas de login: onde começar, o perfil de navegador de cada uma e
 * como reconhecer em que passo o login está.
 *
 * O perfil (`/data/profiles/<pasta>`) é o mesmo que o keep-alive e a
 * auditoria abrem depois: a plataforma vê sempre o mesmo "dispositivo", com
 * cookies, localStorage e o "lembrar este dispositivo" preservados.
 *
 * Multi-inquilino (F7): cada usuário tem o próprio perfil, `<user_id>/<perfil>`.
 * As duas sessões de antes da F7 continuam na pasta antiga (`<perfil>`), gravada
 * em agent_browser_sessions.profile_dir, para ninguém precisar conectar de novo.
 */

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Pasta de perfil válida para a plataforma: `<perfil>` ou `<uuid>/<perfil>` (a mesma regra do banco). */
export function pastaValida(pasta, plataforma) {
  const def = PLATAFORMAS[plataforma];
  if (!def || typeof pasta !== 'string') return false;
  return new RegExp(`^(${UUID}/)?${def.perfil}$`).test(pasta);
}

/** Pasta de perfil de uma sessão nova do usuário. */
export const pastaDoUsuario = (usuarioId, plataforma) => `${usuarioId}/${PLATAFORMAS[plataforma].perfil}`;

export const PLATAFORMAS = {
  airbnb: {
    nome: 'Airbnb',
    // Valor de `domain` em agent_browser_sessions.
    dominio: 'airbnb.com.br',
    perfil: 'airbnb',
    inicio: 'https://www.airbnb.com.br/hosting/reservations',
    cookiesDe: ['airbnb.com.br', 'airbnb.com'],
  },
  booking: {
    nome: 'Booking.com',
    dominio: 'admin.booking.com',
    perfil: 'booking',
    inicio: 'https://admin.booking.com/',
    cookiesDe: ['booking.com'],
  },
};

/**
 * Roda na página (via Runtime.evaluate do próprio proxy, nunca do front):
 * só lê o que está visível para dizer em que passo o login está.
 */
export const SONDA = `(() => {
  const visivel = (el) => {
    if (!el || el.disabled) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const algum = (sel) => Array.from(document.querySelectorAll(sel)).some(visivel);
  return {
    host: location.host,
    caminho: location.pathname,
    busca: location.search,
    titulo: document.title,
    senha: algum('input[type="password"]'),
    codigo: algum('input[autocomplete="one-time-code"], input[name*="code" i], input[id*="code" i], input[name*="otp" i], input[inputmode="numeric"][maxlength="1"]'),
    email: algum('input[type="email"], input[autocomplete="username"], input[name*="email" i], input[name*="username" i], input[name="loginname"], input[type="tel"]'),
    captcha: !!document.querySelector('iframe[src*="captcha" i], iframe[src*="challenge" i], iframe[title*="captcha" i], #px-captcha, [id*="captcha" i], [class*="g-recaptcha"]'),
  };
})()`;

/**
 * Passo do login a partir da sonda e dos nomes dos cookies da plataforma.
 * @returns {'carregando'|'email'|'senha'|'codigo'|'captcha'|'conectado'}
 */
export function passoDoLogin(plataforma, sonda, nomesDeCookies = []) {
  if (!sonda) return 'carregando';
  const cookies = new Set(nomesDeCookies);

  if (plataforma === 'airbnb') {
    // `_aat` é o token de autenticação: só existe com a conta logada.
    const naAreaDoAnfitriao = sonda.host.endsWith('airbnb.com.br') && sonda.caminho.startsWith('/hosting');
    if (naAreaDoAnfitriao && cookies.has('_aat') && !sonda.senha && !sonda.email) return 'conectado';
  }

  if (plataforma === 'booking') {
    // A extranet logada sempre traz a sessão (`ses=`) no endereço.
    const naExtranet = sonda.host === 'admin.booking.com' && sonda.caminho.includes('/hotel/hoteladmin/') && sonda.busca.includes('ses=');
    if (naExtranet && !sonda.senha && !sonda.email) return 'conectado';
  }

  if (sonda.captcha) return 'captcha';
  if (sonda.codigo) return 'codigo';
  if (sonda.senha) return 'senha';
  if (sonda.email) return 'email';
  return 'carregando';
}
