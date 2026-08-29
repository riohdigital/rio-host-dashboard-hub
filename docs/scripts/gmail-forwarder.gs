/**
 * Encaminhador de reservas Gmail -> RioHost Dashboard
 * ---------------------------------------------------
 * Google Apps Script (gratuito) que lê os e-mails do Airbnb e do Booking.com
 * na sua caixa do Gmail e envia para a Edge Function `ingest-reservation-email`.
 *
 * COMO USAR
 * 1. Acesse https://script.google.com e crie um novo projeto.
 * 2. Cole este arquivo inteiro em Código.gs.
 * 3. Ajuste as constantes abaixo (URL da função e segredo).
 * 4. Rode `configurar()` uma vez e autorize o acesso ao Gmail.
 * 5. Em "Acionadores" (relógio), crie um acionador de tempo para
 *    `sincronizarReservas` a cada 10 ou 30 minutos.
 *
 * Para recuperar reservas antigas, ajuste BACKFILL_DESDE e rode
 * `sincronizarHistorico` manualmente, repetindo enquanto o registro avisar
 * que ainda restam conversas. Nunca coloque essa função num acionador.
 *
 * O script marca cada mensagem processada com o rótulo definido em LABEL_OK,
 * então nada é enviado duas vezes.
 */

// ------------------------- CONFIGURAÇÃO -------------------------------------
const FUNCTION_URL =
  'https://cwcauobnbmzjpqjmmomc.supabase.co/functions/v1/ingest-reservation-email';

/** Mesmo valor do secret CHANNEL_SYNC_SECRET configurado no Supabase. */
const SYNC_SECRET = 'COLE_AQUI_O_SEGREDO';

/** Rótulo aplicado às mensagens já aproveitadas. */
const LABEL_OK = 'Rioh Host/Processado';

/**
 * Rótulo das mensagens que o dashboard recebeu mas não conseguiu aproveitar
 * ainda (propriedade não identificada, datas ilegíveis).
 *
 * Elas continuam entrando nas próximas execuções: assim que a configuração
 * melhorar — um apelido de anúncio aprendido, uma reserva do calendário que
 * chegou depois — a mensagem é reaproveitada sozinha, sem ninguém mexer no
 * Gmail.
 */
const LABEL_PENDENTE = 'Rioh Host/Pendente';

/** Quantos dias para trás olhar em cada execução automática. */
const JANELA_DIAS = 7;

/**
 * Data inicial do backfill, no formato AAAA/MM/DD.
 * Usada apenas por sincronizarHistorico(), para recuperar reservas antigas.
 */
const BACKFILL_DESDE = '2026/04/15';

/** Quantas mensagens enviar por execução. */
const LOTE = 25;

/** Limite aceito pela Edge Function numa única requisição. */
const LIMITE_POR_REQUISICAO = 50;

/** Quantas conversas examinar por execução. */
const LOTE_CONVERSAS = 100;

/** Converte "Rioh Host/Processado" na forma que a busca do Gmail entende. */
function comoRotuloDeBusca_(nome) {
  return nome.replace(/\//g, '-').replace(/\s+/g, '-');
}

// Exclui só o que já foi aproveitado. O que ficou pendente volta na próxima.
const QUERY_BASE =
  '(from:airbnb.com OR from:booking.com) ' +
  '-label:' + comoRotuloDeBusca_(LABEL_OK);
// ----------------------------------------------------------------------------

function configurar() {
  obterOuCriarRotulo_(LABEL_OK);
  Logger.log('Rótulo pronto. Agora crie o acionador de tempo para sincronizarReservas().');
}

/** Execução automática: janela móvel dos últimos JANELA_DIAS dias. */
function sincronizarReservas() {
  processarLote_('newer_than:' + JANELA_DIAS + 'd');
}

/**
 * Recuperação de histórico: tudo desde BACKFILL_DESDE.
 *
 * Rode manualmente, quantas vezes forem necessárias — cada execução processa
 * um lote e o registro avisa quando ainda sobram conversas. Não deixe esta
 * função num acionador de tempo.
 */
function sincronizarHistorico() {
  processarLote_('after:' + BACKFILL_DESDE);
}

/**
 * Envia um lote de e-mails para o dashboard.
 *
 * Uma conversa só recebe o rótulo de processada depois que TODAS as suas
 * mensagens foram aceitas pelo dashboard. Sem isso, uma conversa que ficou de
 * fora do lote seria marcada como processada sem nunca ter sido enviada.
 */
function processarLote_(filtroData) {
  const rotuloOk = obterOuCriarRotulo_(LABEL_OK);
  const rotuloPendente = obterOuCriarRotulo_(LABEL_PENDENTE);
  const query = QUERY_BASE + ' ' + filtroData;
  const threads = GmailApp.search(query, 0, LOTE_CONVERSAS);

  if (threads.length === 0) {
    Logger.log('Nenhum e-mail novo para "%s".', filtroData);
    return;
  }

  const emails = [];
  const conversas = [];
  // Para cada e-mail enviado, de qual conversa ele veio.
  const origem = [];

  for (let i = 0; i < threads.length; i++) {
    const mensagens = threads[i].getMessages();

    if (mensagens.length > LIMITE_POR_REQUISICAO) {
      Logger.log('Conversa com %s mensagens, acima do limite. Pulada: "%s"',
        mensagens.length, threads[i].getFirstMessageSubject());
      continue;
    }

    // Não parte a conversa no meio: o que não couber fica para a próxima.
    if (emails.length > 0 && emails.length + mensagens.length > LOTE) break;

    const indiceDaConversa = conversas.length;
    conversas.push(threads[i]);

    for (let j = 0; j < mensagens.length; j++) {
      const message = mensagens[j];
      emails.push({
        from: message.getFrom(),
        subject: message.getSubject(),
        html: message.getBody(),
        text: message.getPlainBody(),
        messageId: message.getId(),
        receivedAt: message.getDate().toISOString(),
      });
      origem.push(indiceDaConversa);
    }
  }

  if (emails.length === 0) {
    Logger.log('Nada a enviar nesta execução.');
    return;
  }

  const resposta = UrlFetchApp.fetch(FUNCTION_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-sync-secret': SYNC_SECRET },
    payload: JSON.stringify({ emails: emails }),
    muteHttpExceptions: true,
  });

  const codigo = resposta.getResponseCode();
  const corpo = resposta.getContentText();

  if (codigo < 200 || codigo >= 300) {
    // Sem rótulo: a próxima execução tenta os mesmos e-mails de novo.
    Logger.log('Falha HTTP %s: %s', codigo, corpo);
    throw new Error('Falha ao enviar para o dashboard: HTTP ' + codigo);
  }

  // Conversa que gerou pendência não é marcada como processada: ela volta nas
  // próximas execuções até o dashboard conseguir aproveitá-la.
  const pendentes = {};
  let resultados = [];
  try {
    resultados = (JSON.parse(corpo) || {}).results || [];
  } catch (erro) {
    Logger.log('Resposta não pôde ser lida como JSON: %s', erro);
  }

  for (let i = 0; i < resultados.length; i++) {
    if (resultados[i] && resultados[i].action === 'pending' && origem[i] !== undefined) {
      pendentes[origem[i]] = true;
    }
  }

  let comPendencia = 0;
  for (let i = 0; i < conversas.length; i++) {
    if (pendentes[i]) {
      conversas[i].addLabel(rotuloPendente);
      comPendencia++;
    } else {
      conversas[i].addLabel(rotuloOk);
      conversas[i].removeLabel(rotuloPendente);
    }
  }

  Logger.log('Enviados %s e-mail(s) de %s conversa(s); %s aguardando conferência. Resposta: %s',
    emails.length, conversas.length, comPendencia, corpo);

  if (conversas.length < threads.length) {
    Logger.log('Ainda restam conversas para processar — rode esta função de novo.');
  }
}

/**
 * Devolve à fila todos os e-mails já processados, para que passem de novo pela
 * lógica atual do dashboard.
 *
 * Útil depois de uma melhoria no reconhecimento: nada é apagado, só o rótulo
 * de "processado" sai e a próxima execução reavalia tudo.
 */
function reprocessarTudo() {
  const rotuloOk = obterOuCriarRotulo_(LABEL_OK);
  const rotuloPendente = obterOuCriarRotulo_(LABEL_PENDENTE);
  let removidas = 0;

  // Em blocos: uma caixa grande não cabe numa única busca.
  for (let volta = 0; volta < 20; volta++) {
    const threads = rotuloOk.getThreads(0, 100);
    if (threads.length === 0) break;

    for (let i = 0; i < threads.length; i++) {
      threads[i].removeLabel(rotuloOk);
      threads[i].removeLabel(rotuloPendente);
      removidas++;
    }
  }

  Logger.log('%s conversa(s) devolvidas à fila. Rode sincronizarHistorico para reavaliar.',
    removidas);
}

/** Simulação: mostra o que seria extraído sem gravar nada no banco. */
function testarSemGravar() {
  const threads = GmailApp.search(QUERY_BASE + ' newer_than:30d', 0, 3);
  if (threads.length === 0) {
    Logger.log('Nenhum e-mail encontrado para teste.');
    return;
  }

  const message = threads[0].getMessages()[0];
  const resposta = UrlFetchApp.fetch(FUNCTION_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-sync-secret': SYNC_SECRET },
    payload: JSON.stringify({
      dryRun: true,
      from: message.getFrom(),
      subject: message.getSubject(),
      html: message.getBody(),
      text: message.getPlainBody(),
      messageId: message.getId(),
    }),
    muteHttpExceptions: true,
  });

  Logger.log(resposta.getContentText());
}

function obterOuCriarRotulo_(nome) {
  return GmailApp.getUserLabelByName(nome) || GmailApp.createLabel(nome);
}
