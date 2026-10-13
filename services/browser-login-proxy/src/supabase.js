/**
 * Supabase com o login de quem está conectando: o proxy não tem chave de
 * service role. Ele confere o usuário pelo token do dashboard e grava a sessão
 * da plataforma em nome dele — a política da tabela só deixa usuário master
 * ler e atualizar (sql/2026-10-12_rls_agent_browser_sessions.sql).
 */

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
    /** Usuário master dono do token, ou null. */
    async usuarioMaster(token) {
      if (!token || typeof token !== 'string') return null;
      const r = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
        headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return null;
      const usuario = await r.json();
      if (!usuario?.id) return null;
      const p = await rest(token, `user_profiles?select=role&user_id=eq.${encodeURIComponent(usuario.id)}`, {
        headers: { Prefer: '' },
      });
      if (!p.ok) return null;
      const [perfil] = await p.json();
      return perfil?.role === 'master' ? { id: usuario.id, email: usuario.email } : null;
    },

    /** Trava o login da plataforma (o keep-alive e a auditoria respeitam). */
    async travar(token, dominio, ateIso) {
      const r = await rest(token, `agent_browser_sessions?domain=eq.${encodeURIComponent(dominio)}`, {
        method: 'PATCH',
        body: JSON.stringify({ login_lock_until: ateIso }),
      });
      return r.ok;
    },

    /** Login concluído: sessão válida e cookies guardados (transição até o agente usar o perfil). */
    async registrarLogin(token, dominio, cookies) {
      const agora = new Date().toISOString();
      const r = await rest(token, `agent_browser_sessions?domain=eq.${encodeURIComponent(dominio)}`, {
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
