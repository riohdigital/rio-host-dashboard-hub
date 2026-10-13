/** Configuração por variável de ambiente (valores no EasyPanel, nunca no código). */

const obrigatoria = (nome) => {
  const v = process.env[nome];
  if (!v) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return v;
};

export function carregarConfig() {
  return {
    porta: Number(process.env.PORT || 3000),
    supabaseUrl: obrigatoria('SUPABASE_URL').replace(/\/$/, ''),
    supabaseAnonKey: obrigatoria('SUPABASE_ANON_KEY'),
    // Rede interna do EasyPanel (ex.: ws://extra-apps_browserless:3000). Sem barra no fim.
    browserlessWs: obrigatoria('BROWSERLESS_WS').replace(/\/$/, ''),
    browserlessToken: process.env.BROWSERLESS_TOKEN || '',
    pastaPerfis: process.env.PASTA_PERFIS || '/data/profiles',
    // Origens do dashboard autorizadas a abrir o WebSocket (vírgula; aceita *.dominio).
    origens: (process.env.ORIGENS_PERMITIDAS || '').split(',').map((s) => s.trim()).filter(Boolean),
    duracaoMaximaMs: Number(process.env.DURACAO_MAXIMA_MS || 15 * 60_000),
    ociosidadeMs: Number(process.env.OCIOSIDADE_MS || 5 * 60_000),
    // Janela do Chrome = tela virtual do Browserless (Xvfb 1024x768 no start.sh da imagem).
    // Janela maior que a tela é impossível num computador real e denuncia o robô.
    larguraTela: Number(process.env.LARGURA_TELA || 1024),
    alturaTela: Number(process.env.ALTURA_TELA || 768),
    // Coerente com o IP de saída da VPS (Hostinger, Holanda). UTC é marca de servidor.
    fusoHorario: process.env.FUSO_HORARIO || 'Europe/Amsterdam',
    idioma: process.env.IDIOMA || 'pt-BR',
  };
}

/** A origem do navegador do Dono bate com a lista? `*.lovable.app` aceita subdomínios. */
export function origemPermitida(origem, permitidas) {
  if (!origem) return false;
  let host;
  try {
    host = new URL(origem).host;
  } catch {
    return false;
  }
  return permitidas.some((p) => {
    const alvo = p.replace(/^https?:\/\//, '');
    if (alvo.startsWith('*.')) return host.endsWith(alvo.slice(1));
    return host === alvo;
  });
}
