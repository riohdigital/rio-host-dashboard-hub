// Webhooks do n8n chamados pelo dashboard.
//
// O endereço principal é o domínio próprio (n8n.rioh.digital). O do EasyPanel
// continua respondendo e fica de reserva: a rede do trabalho do Dono (Zscaler)
// bloqueia o rioh.digital e responde 403 em HTML antes de o pedido chegar ao n8n.
// A reserva só é usada quando o pedido comprovadamente não chegou ao n8n (falha
// de rede ou esse 403 em HTML), então nenhum workflow roda duas vezes.

const BASE_PRINCIPAL =
  (import.meta.env.VITE_N8N_WEBHOOK_BASE as string | undefined) ?? 'https://n8n.rioh.digital/webhook';
const BASE_RESERVA = 'https://n8n-n8n.dgyrua.easypanel.host/webhook';

const BASES = [...new Set([BASE_PRINCIPAL, BASE_RESERVA].map((b) => b.replace(/\/+$/, '')))];

// Os erros do próprio n8n vêm em JSON; o bloqueio do filtro de rede vem em HTML.
const bloqueadoNoCaminho = (resp: Response) =>
  resp.status === 403 && (resp.headers.get('content-type') ?? '').includes('text/html');

/** `caminho` é o path do webhook, ex.: `rioh-host-yield-radar-manual`. */
export async function fetchN8n(caminho: string, init?: RequestInit): Promise<Response> {
  const path = caminho.replace(/^\/+/, '');
  let erro: unknown;
  for (let i = 0; i < BASES.length; i++) {
    const ultimo = i === BASES.length - 1;
    try {
      const resp = await fetch(`${BASES[i]}/${path}`, init);
      if (!ultimo && bloqueadoNoCaminho(resp)) continue;
      return resp;
    } catch (e) {
      // Cancelamento pedido por quem chamou não é falha de rede: não tenta de novo.
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      erro = e;
    }
  }
  throw erro;
}
