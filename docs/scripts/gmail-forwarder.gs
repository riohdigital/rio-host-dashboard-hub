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
 *    `sincronizarReservas` a cada 5 ou 10 minutos.
 *
 * O script marca cada mensagem processada com o rótulo definido em LABEL_OK,
 * então nada é enviado duas vezes.
 */

// ------------------------- CONFIGURAÇÃO -------------------------------------
const FUNCTION_URL =
  'https://cwcauobnbmzjpqjmmomc.supabase.co/functions/v1/ingest-reservation-email';

/** Mesmo valor do secret CHANNEL_SYNC_SECRET configurado no Supabase. */
const SYNC_SECRET = 'COLE_AQUI_O_SEGREDO';

/** Rótulo aplicado às mensagens já enviadas. */
const LABEL_OK = 'RioHost/Processado';

/** Quantos dias para trás olhar na primeira execução. */
const JANELA_DIAS = 7;

/** Quantas mensagens enviar por execução (limite da função: 50). */
const LOTE = 25;

const QUERY_BASE =
  '(from:airbnb.com OR from:booking.com) ' +
  '-label:' + LABEL_OK.replace(/\//g, '-').replace(/\s/g, '-');
// ----------------------------------------------------------------------------

function configurar() {
  obterOuCriarRotulo_(LABEL_OK);
  Logger.log('Rótulo pronto. Agora crie o acionador de tempo para sincronizarReservas().');
}

function sincronizarReservas() {
  const rotulo = obterOuCriarRotulo_(LABEL_OK);
  const query = QUERY_BASE + ' newer_than:' + JANELA_DIAS + 'd';
  const threads = GmailApp.search(query, 0, LOTE);

  if (threads.length === 0) {
    Logger.log('Nenhum e-mail novo.');
    return;
  }

  const emails = [];
  const processadas = [];

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      if (emails.length >= LOTE) return;

      emails.push({
        from: message.getFrom(),
        subject: message.getSubject(),
        html: message.getBody(),
        text: message.getPlainBody(),
        messageId: message.getId(),
        receivedAt: message.getDate().toISOString(),
      });
    });
    processadas.push(thread);
  });

  if (emails.length === 0) return;

  const resposta = UrlFetchApp.fetch(FUNCTION_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-sync-secret': SYNC_SECRET },
    payload: JSON.stringify({ emails: emails }),
    muteHttpExceptions: true,
  });

  const codigo = resposta.getResponseCode();
  const corpo = resposta.getContentText();

  if (codigo >= 200 && codigo < 300) {
    processadas.forEach(function (thread) {
      thread.addLabel(rotulo);
    });
    Logger.log('Enviados %s e-mail(s). Resposta: %s', emails.length, corpo);
  } else {
    // Sem rótulo: a próxima execução tenta de novo.
    Logger.log('Falha HTTP %s: %s', codigo, corpo);
    throw new Error('Falha ao enviar para o dashboard: HTTP ' + codigo);
  }
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
