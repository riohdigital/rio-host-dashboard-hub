/**
 * Supabase com o login de quem está conectando: o proxy não tem chave de
 * service role. Ele confere o usuário pelo token do dashboard e grava a sessão
 * da plataforma em nome dele. Pela política da tabela, cada usuário só lê, cria
 * e atualiza as próprias sessões; o master vê todas
 * (n8n-manager/projects/rioh-host/sql/2026-10-21_f7_sessoes_por_usuario.sql).
 */
import { PLATAFORMAS, pastaDoUsuario, pastaValida } from './plataformas.js';

// Quem cuida de imóveis conecta as próprias contas das plataformas.
const PAPEIS_QUE_CONECTAM = new Set(['master', 'owner']);

export function criarSupabase(config) {
  const rest = (token, caminho, init = {}) => fetch(`${config.supabaseUrl}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(init.headers || {}),
    },
  });

  return {
    /** Usuário dono do token que pode conectar plataformas (master ou owner ativo), ou null. */
    async usuarioQueConecta(token) {
      if (!token || typeof token !== 'string') return null;
      const r = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
        headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return null;
      const usuario = await r.json();
      if (!usuario?.id) return null;
      const p = await rest(token, `user_profiles?select=role,is_active&user_id=eq.${encodeURIComponent(usuario.id)}`, {
        headers: { Prefer: '' },
      });
      if (!p.ok) return null;
      const [perfil] = await p.json();
      if (!perfil || !PAPEIS_QUE_CONECTAM.has(perfil.role) || perfil.is_active === false) return null;
      return { id: usuario.id, email: usuario.email, papel: perfil.role };
    },

    /**
     * A sessão do usuário na plataforma: { id, pasta }. Sem sessão ainda, cria a linha dele
     * (inválida até o login terminar) com a pasta de perfil própria.
     */
    async sessaoDoUsuario(token, usuarioId, plataforma) {
      const def = PLATAFORMAS[plataforma];
      const filtro = `user_id=eq.${encodeURIComponent(usuarioId)}&domain=eq.${encodeURIComponent(def.dominio)}&session_name=eq.default`;
      const lida = await rest(token, `agent_browser_sessions_status?select=id,profile_dir&${filtro}`, { headers: { Prefer: '' } });
      if (!lida.ok) throw new Error(`Falha ao ler a sessão (${lida.status})`);
      const [atual] = await lida.json();
      if (atual) {
        if (!pastaValida(atual.profile_dir, plataforma)) throw new Error('Pasta de perfil inválida');
        return { id: atual.id, pasta: atual.profile_dir };
      }
      const nova = await rest(token, 'agent_browser_sessions?select=id,profile_dir', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          user_id: usuarioId,
          domain: def.dominio,
          session_name: 'default',
          profile_dir: pastaDoUsuario(usuarioId, plataforma),
          is_valid: false,
        }),
      });
      if (!nova.ok) throw new Error(`Falha ao criar a sessão (${nova.status})`);
      const [criada] = await nova.json();
      return { id: criada.id, pasta: criada.profile_dir };
    },

    /** Trava o login da sessão (o keep-alive e a auditoria respeitam). */
    async travar(token, sessaoId, ateIso) {
      const r = await rest(token, `agent_browser_sessions?id=eq.${encodeURIComponent(sessaoId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ login_lock_until: ateIso }),
      });
      return r.ok;
    },

    /** Login concluído: sessão válida e cookies guardados (transição até o agente usar o perfil). */
    async registrarLogin(token, sessaoId, cookies) {
      const agora = new Date().toISOString();
      const r = await rest(token, `agent_browser_sessions?id=eq.${encodeURIComponent(sessaoId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          cookies_encrypted: JSON.stringify(cookies),
          is_valid: true,
          updated_at: agora,
          last_used_at: agora,
          login_lock_until: null,
        }),
      });
      if (!r.ok) throw new Error(`Falha ao registrar a sessão (${r.status})`);
    },
  };
}
