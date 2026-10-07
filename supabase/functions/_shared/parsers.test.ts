/**
 * Testes dos parsers de iCal e de e-mail.
 *
 *   deno test supabase/functions/_shared/parsers.test.ts
 *
 * Os fixtures reproduzem o formato real dos feeds e e-mails do Airbnb e do
 * Booking.com. Quando um layout mudar, é aqui que se documenta o novo caso.
 */

import { assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts';

import { icsDateToISO, parseIcs } from './ics.ts';
import {
  isPlausibleGuestName,
  looksLikeReservation,
  parsePayoutEmail,
  parseReservationEmail,
} from './emailParsers.ts';
import { pareceNomeDeAnuncio } from './propertyMatching.ts';
import { computeStayCycles, cycleBoundaries, type PayoutEntry } from './stayCycles.ts';
import { datesOverlap } from './reservationSync.ts';
import {
  htmlToText,
  parseDateFlexible,
  parseDateRange,
  parseMoney,
  semelhancaDeTitulos,
} from './textUtils.ts';

const REFERENCE = new Date('2026-08-29T00:00:00Z');

const AIRBNB_ICS = `BEGIN:VCALENDAR
PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN
VERSION:2.0
CALSCALE:GREGORIAN
BEGIN:VEVENT
DTEND;VALUE=DATE:20260915
DTSTART;VALUE=DATE:20260912
UID:1425e8f0a1b2-e0f8e8@airbnb.com
DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/de
 tails/HMABC12XYZ\\nPhone Number (Last 4 Digits): 2959
SUMMARY:Reserved
END:VEVENT
BEGIN:VEVENT
DTEND;VALUE=DATE:20261002
DTSTART;VALUE=DATE:20260930
UID:blocked-1@airbnb.com
SUMMARY:Airbnb (Not available)
END:VEVENT
END:VCALENDAR`;

const BOOKING_ICS = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Booking.com',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261101',
  'DTEND;VALUE=DATE:20261105',
  'UID:5f3a-booking-1@booking.com',
  'SUMMARY:CLOSED - Not available',
  'END:VEVENT', 'END:VCALENDAR',
].join('\r\n');

Deno.test('iCal do Airbnb: eventos, datas e desdobramento de linhas', () => {
  const events = parseIcs(AIRBNB_ICS);

  assertEquals(events.length, 2);
  assertEquals(events[0].start, '2026-09-12');
  assertEquals(events[0].end, '2026-09-15');
  assertEquals(events[0].uid, '1425e8f0a1b2-e0f8e8@airbnb.com');
  assertEquals(events[0].allDay, true);
  // A URL da reserva vem quebrada em duas linhas no feed real.
  assertEquals(events[0].description.includes('details/HMABC12XYZ'), true);
  assertEquals(events[0].description.includes('\nPhone'), true);
  assertEquals(events[1].summary, 'Airbnb (Not available)');
});

Deno.test('iCal do Booking: CRLF e evento de período ocupado', () => {
  const events = parseIcs(BOOKING_ICS);

  assertEquals(events.length, 1);
  assertEquals(events[0].start, '2026-11-01');
  assertEquals(events[0].end, '2026-11-05');
  assertEquals(events[0].summary, 'CLOSED - Not available');
});

Deno.test('icsDateToISO aceita data com horário', () => {
  assertEquals(icsDateToISO('20260912T140000Z'), '2026-09-12');
  assertEquals(icsDateToISO('20260912'), '2026-09-12');
});

Deno.test('parseMoney cobre pt-BR e en-US', () => {
  assertEquals(parseMoney('R$ 1.234,56'), 1234.56);
  assertEquals(parseMoney('$1,234.56'), 1234.56);
  assertEquals(parseMoney('R$ 890,00'), 890);
  assertEquals(parseMoney('1234'), 1234);
  assertEquals(parseMoney('sem valor'), null);
});

Deno.test('parseDateFlexible cobre os formatos usados nos e-mails', () => {
  const options = { reference: REFERENCE } as const;

  assertEquals(parseDateFlexible('12 de setembro de 2026', options), '2026-09-12');
  assertEquals(parseDateFlexible('sáb, 12 de set', options), '2026-09-12');
  // Mês já passado no ano corrente: assume o ano seguinte.
  assertEquals(parseDateFlexible('5 de jan', options), '2027-01-05');
  assertEquals(parseDateFlexible('12/09/2026', options), '2026-09-12');
  assertEquals(parseDateFlexible('2026-09-12', options), '2026-09-12');
  assertEquals(
    parseDateFlexible('Sep 12, 2026', { locale: 'en', reference: REFERENCE }),
    '2026-09-12',
  );
  assertEquals(
    parseDateFlexible('09/12/2026', { locale: 'en', reference: REFERENCE }),
    '2026-09-12',
  );
});

Deno.test('e-mail de confirmação do Airbnb em pt-BR', () => {
  const parsed = parseReservationEmail({
    from: 'Airbnb <automated@airbnb.com>',
    subject: 'Reserva confirmada: Maria Souza chega em 12 de set',
    html: `<html><body><table>
      <tr><td>Anúncio</td><td>Apto Vista Mar 302</td></tr>
      <tr><td>Check-in</td><td>sáb, 12 de set de 2026</td></tr>
      <tr><td>Checkout</td><td>ter, 15 de set de 2026</td></tr>
      <tr><td>Hóspedes</td><td>2 adultos, 1 criança</td></tr>
      <tr><td>Código de confirmação</td><td>HMABC12XYZ</td></tr>
      <tr><td>Total (BRL)</td><td>R$&nbsp;1.850,00</td></tr>
    </table></body></html>`,
  }, { reference: REFERENCE });

  assertEquals(parsed.platform, 'Airbnb');
  assertEquals(parsed.intent, 'new');
  assertEquals(parsed.reservationCode, 'HMABC12XYZ');
  assertEquals(parsed.checkIn, '2026-09-12');
  assertEquals(parsed.checkOut, '2026-09-15');
  assertEquals(parsed.numberOfGuests, 3);
  // Valor do Airbnb não vem de e-mail (R1 em REGRAS_DE_NEGOCIO_RESERVAS.md): os
  // e-mails reais trouxeram o preço antes da taxa de serviço e o total pago
  // pelo hóspede, nunca "Total + Cotas do coanfitrião".
  assertEquals(parsed.totalRevenue, null);
  assertEquals(parsed.listingName, 'Apto Vista Mar 302');
  // O nome do hóspede só existe no assunto — o corpo traz o rótulo "Hóspedes".
  assertEquals(parsed.guestName, 'Maria Souza');
  assertEquals(parsed.missing, ['totalRevenue']);
});

Deno.test('e-mail de nova reserva do Booking.com em pt-BR', () => {
  const parsed = parseReservationEmail({
    from: 'Booking.com <noreply@booking.com>',
    subject: 'Nova reserva confirmada - 4821956733',
    html: `<div>
      <p>Nome da acomodação: Casa Azul Centro</p>
      <p>Número da reserva: 4821956733</p>
      <p>Nome do hóspede: João Pereira</p>
      <p>Chegada: 01/11/2026</p>
      <p>Partida: 05/11/2026</p>
      <p>Número de hóspedes: 2</p>
      <p>Preço total: R$ 2.400,00</p>
      <p>Comissão: R$ 360,00</p>
    </div>`,
  }, { reference: REFERENCE });

  assertEquals(parsed.platform, 'Booking.com');
  assertEquals(parsed.reservationCode, '4821956733');
  assertEquals(parsed.guestName, 'João Pereira');
  assertEquals(parsed.checkIn, '2026-11-01');
  assertEquals(parsed.checkOut, '2026-11-05');
  assertEquals(parsed.numberOfGuests, 2);
  // R1 da Booking: valor comissionável − comissão.
  assertEquals(parsed.totalRevenue, 2040);
  assertEquals(parsed.commissionAmount, 360);
  assertEquals(parsed.listingName, 'Casa Azul Centro');
});

Deno.test('e-mail de cancelamento é reconhecido como tal', () => {
  const parsed = parseReservationEmail({
    from: 'noreply@booking.com',
    subject: 'Reserva cancelada - 4821956733',
    text: [
      'Número da reserva: 4821956733',
      'Chegada: 01/11/2026',
      'Partida: 05/11/2026',
      'A reserva foi cancelada pelo hóspede.',
    ].join('\n'),
  }, { reference: REFERENCE });

  assertEquals(parsed.intent, 'cancelled');
  assertEquals(parsed.reservationCode, '4821956733');
  assertEquals(parsed.checkIn, '2026-11-01');
});

Deno.test('remetente desconhecido não vira reserva', () => {
  const parsed = parseReservationEmail({
    from: 'newsletter@exemplo.com',
    subject: 'Promoção de hospedagem',
    text: 'Nada a ver com reservas.',
  }, { reference: REFERENCE });

  assertEquals(parsed.platform, null);
  assertEquals(parsed.missing, ['platform']);
});

Deno.test('htmlToText preserva quebras de tabela e decodifica entidades', () => {
  assertEquals(htmlToText('<p>Total:&nbsp;R$&nbsp;100,00</p>'), 'Total: R$ 100,00');
  assertEquals(htmlToText('<tr><td>Check-in</td><td>12/09/2026</td></tr>'), 'Check-in\n12/09/2026');
});

Deno.test('datesOverlap: check-out é dia livre, então back-to-back não é conflito', () => {
  // Mesma estadia espelhada entre Airbnb e Booking pelo calendário cruzado.
  assertEquals(datesOverlap('2026-09-12', '2026-09-15', '2026-09-12', '2026-09-15'), true);

  // Um hóspede sai no dia 15 e outro entra no dia 15: normal, não é conflito.
  assertEquals(datesOverlap('2026-09-12', '2026-09-15', '2026-09-15', '2026-09-18'), false);
  assertEquals(datesOverlap('2026-09-15', '2026-09-18', '2026-09-12', '2026-09-15'), false);

  // Sobreposições reais.
  assertEquals(datesOverlap('2026-09-12', '2026-09-16', '2026-09-15', '2026-09-18'), true);
  assertEquals(datesOverlap('2026-09-13', '2026-09-14', '2026-09-12', '2026-09-18'), true);

  // Períodos distintos.
  assertEquals(datesOverlap('2026-09-12', '2026-09-15', '2026-10-01', '2026-10-05'), false);
});

Deno.test('e-mails da plataforma que não são reserva são descartados', () => {
  // Caso real: as plataformas mandam muito mais que confirmações.
  const aviso = parseReservationEmail({
    from: 'Airbnb <express@airbnb.com>',
    subject: 'Atividade da conta: endereço de email alterado',
    text: 'O endereço de e-mail da sua conta do Airbnb foi alterado. Se não foi você, acesse airbnb.com.',
  }, { reference: REFERENCE });

  assertEquals(aviso.platform, 'Airbnb');
  assertEquals(looksLikeReservation(aviso), false);

  const marketing = parseReservationEmail({
    from: 'Booking.com <news@booking.com>',
    subject: 'Ofertas imperdíveis para sua próxima viagem',
    text: 'Descontos de até 30% em milhares de acomodações.',
  }, { reference: REFERENCE });
  assertEquals(looksLikeReservation(marketing), false);

  const avaliacao = parseReservationEmail({
    from: 'Airbnb <automated@airbnb.com>',
    subject: 'Avalie seu hóspede',
    text: 'Você tem 14 dias para escrever a avaliação. Acesse airbnb.com/reviews.',
  }, { reference: REFERENCE });
  assertEquals(looksLikeReservation(avaliacao), false);

  // Uma reserva de verdade continua passando.
  const reserva = parseReservationEmail({
    from: 'Booking.com <noreply@booking.com>',
    subject: 'Nova reserva confirmada - 4821956733',
    text: 'Número da reserva: 4821956733\nChegada: 01/11/2026\nPartida: 05/11/2026',
  }, { reference: REFERENCE });
  assertEquals(looksLikeReservation(reserva), true);

  // Sem código legível, mas com as duas datas, ainda vale conferir.
  const semCodigo = parseReservationEmail({
    from: 'automated@airbnb.com',
    subject: 'Reserva confirmada',
    text: 'Check-in: 12 de setembro de 2026\nCheckout: 15 de setembro de 2026',
  }, { reference: REFERENCE });
  assertEquals(looksLikeReservation(semCodigo), true);
});

Deno.test('assunto do "Nova reserva!" do Booking: data sim, nome não', () => {
  // Formato real: "(CÓDIGO, dia da semana, data)". Não há nome de hóspede
  // nesse assunto — tentar extrair um só produzia lixo ("feira", "(6859442149").
  const nova = parseReservationEmail({
    from: 'Booking.com <noreply@booking.com>',
    subject: 'Booking.com - Nova reserva! (6124022858, sexta-feira, 11 de setembro de 2026)',
    text: 'Acesse a extranet para ver os detalhes da reserva.',
  }, { reference: REFERENCE });

  assertEquals(nova.reservationCode, '6124022858');
  // O corpo não traz datas: o check-in vem do próprio assunto.
  assertEquals(nova.checkIn, '2026-09-11');
  assertEquals(nova.guestName, null);

  const ultimaHora = parseReservationEmail({
    from: 'noreply@booking.com',
    subject: 'Booking.com - Nova reserva de última hora (5000446589, quarta-feira, 22 de julho de 2026)',
    text: 'Detalhes na extranet.',
  }, { reference: REFERENCE });

  assertEquals(ultimaHora.reservationCode, '5000446589');
  assertEquals(ultimaHora.checkIn, '2026-07-22');
  assertEquals(ultimaHora.guestName, null);
});

Deno.test('o nome do hóspede vem dos assuntos que realmente o contêm', () => {
  const mensagem = parseReservationEmail({
    from: 'Booking.com <noreply@booking.com>',
    subject: 'Recebemos uma mensagem de Maico Mombach',
    html: `<div><p>Nome da acomodação: Studio próximo a Praia de Copacabana</p>
      <p>Número da reserva: 6124022858</p>
      <p>Chegada: 11/09/2026</p><p>Partida: 14/09/2026</p>
      <p>Número de hóspedes: 3</p></div>`,
  }, { reference: REFERENCE });

  assertEquals(mensagem.guestName, 'Maico Mombach');
  assertEquals(mensagem.listingName, 'Studio próximo a Praia de Copacabana');
  assertEquals(mensagem.checkIn, '2026-09-11');
  assertEquals(mensagem.checkOut, '2026-09-14');

  const solicitacao = parseReservationEmail({
    from: 'noreply@booking.com',
    subject: 'A solicitação de Bartłomiej Korpała foi confirmada',
    text: 'Número da reserva: 5650506482\nPartida: 26/07/2026',
  }, { reference: REFERENCE });

  assertEquals(solicitacao.guestName, 'Bartłomiej Korpała');
});

Deno.test('isPlausibleGuestName barra os falsos positivos observados', () => {
  assertEquals(isPlausibleGuestName('(6859442149'), false);  // pedaço do código
  assertEquals(isPlausibleGuestName('da'), false);           // preposição solta
  assertEquals(isPlausibleGuestName('feira'), false);        // de "quarta-feira"
  assertEquals(isPlausibleGuestName('acomodação'), false);
  assertEquals(isPlausibleGuestName(''), false);

  assertEquals(isPlausibleGuestName('Maria Souza'), true);
  assertEquals(isPlausibleGuestName('Bartłomiej Korpała'), true);
});

Deno.test('semelhancaDeTitulos reconhece anúncio renomeado', () => {
  const acima = (a: string, b: string) => semelhancaDeTitulos(a, b) >= 0.6;

  // Renomeações do mesmo anúncio: precisam passar do corte de 0,6.
  assertEquals(acima('Studio próximo a Praia de Copacabana', 'Studio Copacabana Praia'), true);
  assertEquals(
    acima('Studio próximo a Praia de Copacabana', 'Studio proximo à Praia de Copacabana - Reformado'),
    true,
  );
  assertEquals(
    acima(
      'Lapa, Museus, Teatros e Aeroporto a Pé em Studio no Centro do Rio!',
      'Studio no Centro do Rio: Lapa, Museus e Teatros',
    ),
    true,
  );
  assertEquals(acima('Brisa do Mar Flat', 'Flat Brisa do Mar - Vista'), true);

  // Anúncios de imóveis diferentes: precisam ficar abaixo do corte.
  assertEquals(
    acima('Studio próximo a Praia de Copacabana', 'Lapa, Museus, Teatros e Aeroporto a Pé em Studio no Centro do Rio!'),
    false,
  );
  assertEquals(acima('Studio próximo a Praia de Copacabana', 'Brisa do Mar Flat'), false);

  // O caso perigoso: bairros diferentes com palavras genéricas em comum.
  // Fica em 0,5 — abaixo do corte, e por isso vai para conferência.
  assertEquals(acima('Studio Copacabana Praia', 'Studio Ipanema Praia'), false);

  // Palavras genéricas de hospedagem não criam semelhança sozinhas.
  assertEquals(semelhancaDeTitulos('Studio no Rio', 'Apartamento em Salvador'), 0);
});

Deno.test('hotel_id do Booking identifica a propriedade mesmo sem nome', () => {
  // Corpo real do "Nova reserva!": sem datas, sem hóspede, sem valor. O que
  // identifica a acomodação é o hotel_id no link da extranet — e ele não muda
  // quando o anúncio é renomeado.
  const confirmacao = parseReservationEmail({
    from: 'Booking.com <noreply@booking.com>',
    subject: 'Booking.com - Nova reserva! (6859442149, terça-feira, 12 de janeiro de 2027)',
    html: `<div>Studio próximo a Praia de Copacabana
      <p>Booking confirmation — 6859442149</p>
      <a href="https://admin.booking.com/hotel/hoteladmin/extranet_ng/manage/booking.html?res_id=6859442149&hotel_id=14107413&lang=pt-br">link</a>
    </div>`,
  }, { reference: REFERENCE });

  assertEquals(confirmacao.reservationCode, '6859442149');
  assertEquals(confirmacao.checkIn, '2027-01-12');
  // O link só existe no href: a leitura precisa olhar o HTML cru.
  assertEquals(confirmacao.bookingHotelId, '14107413');

  const outroImovel = parseReservationEmail({
    from: 'noreply@booking.com',
    subject: 'Booking.com - Nova reserva de última hora (5000446589, quarta-feira, 22 de julho de 2026)',
    html: `<div>Lapa, Museus, Teatros e Aeroporto a Pé em Studio no Centro do Rio!
      <a href="https://admin.booking.com/hotel/hoteladmin/extranet_ng/manage/booking.html?res_id=5000446589&hotel_id=14463427">link</a></div>`,
  }, { reference: REFERENCE });

  assertEquals(outroImovel.bookingHotelId, '14463427');

  // Uma das cópias do link pode vir quebrada pela codificação do e-mail:
  // "14107413" aparecendo como "1410". Vale a ocorrência íntegra.
  const linkQuebrado = parseReservationEmail({
    from: 'noreply@booking.com',
    subject: 'Booking.com - Nova reserva! (6859442149, terça-feira, 12 de janeiro de 2027)',
    html: '<a href="...hotel_id=1410">a</a><a href="...hotel_id=14107413">b</a>',
  }, { reference: REFERENCE });

  assertEquals(linkQuebrado.bookingHotelId, '14107413');
});

Deno.test('mensagem de hóspede do Booking traz a reserva completa', () => {
  const mensagem = parseReservationEmail({
    from: 'Caroline F Santos through Booking.com <5746792143-abc@guest.booking.com>',
    subject: 'Recebemos uma mensagem de Caroline F Santos',
    html: `<div><p>Número de confirmação: 5746792143</p>
      <p>Dados da reserva</p>
      <p>Nome do hóspede:</p><p>Caroline F Santos</p>
      <p>Check-in:</p><p>qua., 2 de set. de 2026</p>
      <p>Check-out:</p><p>ter., 8 de set. de 2026</p>
      <p>Nome da propriedade:</p><p>Studio próximo a Praia de Copacabana</p>
      <p>Número da reserva:</p><p>5746792143</p>
      <p>Total de hóspedes:</p><p>2</p></div>`,
  }, { reference: REFERENCE });

  assertEquals(mensagem.guestName, 'Caroline F Santos');
  assertEquals(mensagem.reservationCode, '5746792143');
  assertEquals(mensagem.checkIn, '2026-09-02');
  assertEquals(mensagem.checkOut, '2026-09-08');
  assertEquals(mensagem.numberOfGuests, 2);
  assertEquals(mensagem.listingName, 'Studio próximo a Praia de Copacabana');
});

// ---------------------------------------------------------------------------
// Casos reais de 06/10/2026 (nomes trocados). Cada um já tinha gravado dado
// errado em produção; ver REGRAS_DE_NEGOCIO_RESERVAS.md no n8n-manager.
// ---------------------------------------------------------------------------

Deno.test('resposta automática da Booking: o "check-in" da mensagem não é o campo', () => {
  // A frase do hóspede vem antes dos dados da reserva. Antes da correção, o
  // valor lido para "Check-in" era "seja às 17:00 - 18:00. Pode ser?".
  const parsed = parseReservationEmail({
    from: 'Booking.com <noreply@booking.com>',
    subject: 'A solicitação de Mariana Rocha foi confirmada',
    text: [
      'Número de confirmação: 5500000001',
      'Mariana Rocha disse:',
      'Gostaria de solicitar que meu check-in seja às 17:00 - 18:00. Pode ser?',
      'Confirmado gratuitamente',
      'Dados da reserva',
      'Nome do hóspede:',
      'Mariana Rocha',
      'Check-in:',
      'qui., 7 de jan. de 2027',
      'Check-out:',
      'ter., 12 de jan. de 2027',
      'Nome da propriedade:',
      'Maravilhoso Studio Próximo a Praia em Copacabana!',
      'Número da reserva:',
      '5500000001',
    ].join('\n'),
  }, { reference: REFERENCE });

  assertEquals(parsed.checkIn, '2027-01-07');
  assertEquals(parsed.checkOut, '2027-01-12');
  assertEquals(parsed.guestName, 'Mariana Rocha');
  // "Solicitação" aqui é de horário de check-in, não pedido de reserva: o
  // e-mail continua sendo fonte de dados da reserva.
  assertEquals(['request', 'inquiry'].includes(parsed.intent), false);
});

Deno.test('pedido de reserva não aceito é reconhecido e o período é lido inteiro', () => {
  // Caso HM5B4EB3ST: "2 – 19 de out." virou entrada em 19/10 e saída em 02/10.
  const pedido = parseReservationEmail({
    from: 'Airbnb <automated@airbnb.com>',
    subject: 'Pendente: Pedido de Reserva em Charmoso Apê na Lapa - Aeroporto, Museus e Teatro! para 2 – 19 de out. de 2026',
    text: 'Responda em até 24 horas. https://www.airbnb.com.br/hosting/reservations/details/HMAAAA1111',
  }, { reference: REFERENCE });

  assertEquals(pedido.intent, 'request');
  assertEquals(pedido.checkIn, '2026-10-02');
  assertEquals(pedido.checkOut, '2026-10-19');
});

Deno.test('consulta de hóspede e newsletter não são reserva', () => {
  const consulta = parseReservationEmail({
    from: 'Airbnb <automated@airbnb.com>',
    subject: 'Consulta sobre Resort com Píer e Vista Lateral Mar para 10 – 13 de out. de 2026',
    text: 'Um hóspede enviou uma pergunta. airbnb.com',
  }, { reference: REFERENCE });
  assertEquals(consulta.intent, 'inquiry');

  const newsletter = parseReservationEmail({
    from: 'Airbnb <discover@airbnb.com>',
    subject: 'Perspectiva de reservas para outubro em Rio de Janeiro',
    text: 'O período de 9 de outubro a 11 de outubro é de alta procura. airbnb.com',
  }, { reference: REFERENCE });
  assertEquals(newsletter.intent, 'marketing');
});

Deno.test('confirmação com "Política de cancelamento" no corpo não vira cancelada', () => {
  const confirmacao = parseReservationEmail({
    from: 'Airbnb <automated@airbnb.com>',
    subject: 'Reserva confirmada - Luuk Hurkx chega em 10 de dez.',
    text: 'NOVA RESERVA CONFIRMADA!\nhttps://www.airbnb.com.br/hosting/reservations/details/HMBBBB2222\nPolítica de cancelamento\nRestrita',
  }, { reference: REFERENCE });
  assertEquals(confirmacao.intent, 'new');

  const atualizada = parseReservationEmail({
    from: 'Airbnb <automated@airbnb.com>',
    subject: 'Reserva atualizada',
    text: 'SUA RESERVA COM FERNANDO FOI ATUALIZADA\nhttps://www.airbnb.com.br/hosting/reservations/details/HMCCCC3333',
  }, { reference: REFERENCE });
  assertEquals(atualizada.intent, 'modified');
});

Deno.test('aviso de repasse do Airbnb: lançamentos por reserva', () => {
  // Formato real do "Enviamos um pagamento de R$905,73 BRL".
  const texto = [
    'R$905,73 BRL foram enviados hoje',
    'Identificação do pagamento',
    '0MS2eTESTE0000000000000000',
    'Informações',
    'Fernando Exemplo   -R$3.506,74 BRL',
    'Recebimento do coanfitrião • 06/04/2026 - 02/10/2026',
    'Resort com Píer e Vista Lateral Mar (1366714016506588224)',
    'HMDDDD4444',
    'Fernando Exemplo   R$4.412,47 BRL',
    'Acomodação • 06/04/2026 - 02/10/2026',
    'Resort com Píer e Vista Lateral Mar (1366714016506588224)',
    'HMDDDD4444',
    'Total pago:   R$905,73 BRL',
  ].join('\n');

  const parsed = parseReservationEmail({ from: 'Airbnb <automated@airbnb.com>', subject: 'Enviamos um pagamento de R$905,73 BRL', text: texto });
  assertEquals(parsed.intent, 'payout');

  const repasse = parsePayoutEmail(texto);
  assertEquals(repasse.identificador, '0MS2eTESTE0000000000000000');
  assertEquals(repasse.totalPago, 905.73);
  assertEquals(repasse.linhas.length, 2);
  assertEquals(repasse.linhas[0].valor, -3506.74);
  assertEquals(repasse.linhas[0].tipo, 'Recebimento do coanfitrião');
  assertEquals(repasse.linhas[1].valor, 4412.47);
  assertEquals(repasse.linhas[1].tipo, 'Acomodação');
  assertEquals(repasse.linhas[1].codigo, 'HMDDDD4444');
  assertEquals(repasse.linhas[1].periodoInicio, '2026-04-06');
  assertEquals(repasse.linhas[1].anuncio, 'Resort com Píer e Vista Lateral Mar');
});

Deno.test('parseDateRange cobre os períodos dos assuntos do Airbnb', () => {
  const ref = { reference: REFERENCE };
  assertEquals(parseDateRange('para 2 – 19 de out. de 2026', ref), { checkIn: '2026-10-02', checkOut: '2026-10-19' });
  assertEquals(parseDateRange('22 de set. – 20 de nov.', ref), { checkIn: '2026-09-22', checkOut: '2026-11-20' });
  assertEquals(
    parseDateRange('29 de dez. de 2025 – 3 de jan. de 2026', ref),
    { checkIn: '2025-12-29', checkOut: '2026-01-03' },
  );
  assertEquals(parseDateRange('para 1 – 3 de jan. de 2027', ref), { checkIn: '2027-01-01', checkOut: '2027-01-03' });
  // Horário não é período.
  assertEquals(parseDateRange('check-in seja às 17:00 - 18:00', ref), null);
});

// Corpo em texto do e-mail real de confirmação do Airbnb (06/10/2026), com o
// bloco do hóspede antes do bloco do anfitrião. Nomes e código trocados.
function confirmacaoAirbnb(opcoes: { noites: number; checkout: string; recebe: string; cota?: string }): string {
  return [
    'NOVA RESERVA CONFIRMADA! LUCAS CHEGA EM 10 DE DEZ..',
    'https://www.airbnb.com.br/hosting/reservations/details/HMEEEE5555?isPending=true   Lucas Exemplo',
    'Check-in',
    'qui., 10 de dez.',
    'Checkout',
    opcoes.checkout,
    'CÓDIGO DE CONFIRMAÇÃO',
    'HMEEEE5555',
    'O HÓSPEDE PAGOU',
    `R$\u00a0240,97 x ${opcoes.noites} noites   R$\u00a04.819,44`,
    'Taxa de limpeza   R$\u00a0175,00',
    'TOTAL (BRL)   R$\u00a04.994,44',
    'PAGAMENTO DO ANFITRIÃO',
    `Preço da acomodação para ${opcoes.noites} noites   R$\u00a05.604,00`,
    'Taxa de limpeza   R$\u00a0175,00',
    'Taxa de serviço do anfitrião (16.0% + IVA)   -R$\u00a0909,63',
    ...(opcoes.cota ? [`Cotas do coanfitrião   -R$\u00a0${opcoes.cota}`] : []),
    `VOCÊ RECEBE   R$\u00a0${opcoes.recebe}`,
    'Consultar ganhos',
  ].join('\n');
}

Deno.test('Airbnb: valor da reserva vem do bloco do anfitrião, não do que o hóspede pagou', () => {
  const curta = parseReservationEmail({
    from: 'Airbnb <automated@airbnb.com>',
    subject: 'Reserva confirmada - Lucas Exemplo chega em 10 de dez.',
    text: confirmacaoAirbnb({ noites: 20, checkout: 'qua., 30 de dez.', recebe: '4.084,81' }),
  }, { reference: REFERENCE });

  assertEquals(curta.totalRevenue, 4084.81);
  assertEquals(curta.guestName, 'Lucas Exemplo');
  assertEquals(curta.checkOut, '2026-12-30');

  // Com cota do coanfitrião listada, a R1 soma as duas.
  const comCota = parseReservationEmail({
    from: 'Airbnb <automated@airbnb.com>',
    subject: 'Reserva confirmada - Lucas Exemplo chega em 10 de dez.',
    text: confirmacaoAirbnb({ noites: 20, checkout: 'qua., 30 de dez.', recebe: '1.000,00', cota: '3.084,81' }),
  }, { reference: REFERENCE });
  assertEquals(comCota.totalRevenue, 4084.81);

  // Estadia mensal: o total fica registrado, mas não vai para a reserva (R3).
  const mensal = parseReservationEmail({
    from: 'Airbnb <automated@airbnb.com>',
    subject: 'Reserva confirmada - Lucas Exemplo chega em 10 de dez.',
    text: confirmacaoAirbnb({ noites: 58, checkout: 'sex., 5 de fev. de 2027', recebe: '10.954,57' }),
  }, { reference: REFERENCE });
  assertEquals(mensal.totalRevenue, null);
  assertEquals(mensal.stayTotal, 10954.57);
});

Deno.test('apelido de anúncio: só aprende o que parece nome de anúncio', () => {
  // Apelidos de lixo que estavam gravados na configuração em 06/10/2026.
  assertEquals(pareceNomeDeAnuncio('nos resultados de busca.'), false);
  assertEquals(pareceNomeDeAnuncio('é adequada para crianças atualizando suas Regras'), false);
  assertEquals(pareceNomeDeAnuncio('parece perfeita para mim. Eu adoraria ficar. Obrigado.'), false);
  assertEquals(pareceNomeDeAnuncio('para 20 noites   R$\u00a05.604,00'), false);

  assertEquals(pareceNomeDeAnuncio('Charmoso Apê na Lapa - Aeroporto, Museus e Teatro!'), true);
  assertEquals(pareceNomeDeAnuncio('Espetacular com Vista Mar - 5 Estrelas Flat'), true);
});

Deno.test('nomes que já foram gravados por engano são barrados', () => {
  assertEquals(isPlausibleGuestName('PAGOU'), false);                 // HM552TTR5Z
  assertEquals(isPlausibleGuestName('se for possível fazer'), false); // HM5B4EB3ST
  assertEquals(isPlausibleGuestName('JULIO CESAR PEREIRA DA SILVA'), true);
  assertEquals(isPlausibleGuestName('Luuk Hurkx'), true);
});

// ---------------------------------------------------------------------------
// Ciclos mensais pelos repasses reais (R3). Valores conferidos em 07/10/2026
// contra a API de repasses do Airbnb e o total (R1) de cada reserva.
// ---------------------------------------------------------------------------

const rep = (tipo: string, valor: number, liberadoEm: string): PayoutEntry => ({ tipo, valor, liberadoEm });
const valores = (ciclos: ReturnType<typeof computeStayCycles>) => ciclos.map((c) => [c.inicio, c.fim, c.valor]);

Deno.test('ciclos: fronteiras no mesmo dia do mês, dia inexistente transborda', () => {
  assertEquals(cycleBoundaries('2026-03-10', '2026-03-20'), [{ inicio: '2026-03-10', fim: '2026-03-20' }]);
  assertEquals(cycleBoundaries('2026-03-31', '2026-05-02'), [
    { inicio: '2026-03-31', fim: '2026-05-01' }, { inicio: '2026-05-01', fim: '2026-05-02' },
  ]);
});

Deno.test('ciclos: conta titular com coanfitrião (HMWE2EHT4F, R$ 34.438,10)', () => {
  const C = 'Recebimento do coanfitrião', A = 'Acomodação';
  const ciclos = computeStayCycles({
    checkIn: '2026-04-06', checkOut: '2026-11-01', commissionRate: 0.2, cleaningFee: 200,
    repasses: [
      rep(A, 4543.28, '2026-04-07'), rep(C, -3474.62, '2026-04-07'), rep(A, 61.5, '2026-04-15'), rep(C, -127.86, '2026-04-15'),
      rep(A, 4603.64, '2026-05-07'), rep(C, -3604.26, '2026-05-07'), rep(A, 283.46, '2026-05-19'), rep(C, -277.11, '2026-05-19'),
      rep(A, 4649.92, '2026-06-07'), rep(C, -3669.6, '2026-06-07'), rep(A, 284.85, '2026-06-25'), rep(C, -265.52, '2026-06-25'),
      rep(A, 4628.92, '2026-07-07'), rep(C, -3665.49, '2026-07-07'), rep(A, 458.27, '2026-07-21'), rep(C, -395.61, '2026-07-21'),
      rep(A, 4448.97, '2026-08-07'), rep(C, -3530.18, '2026-08-07'), rep(A, 717.23, '2026-08-22'), rep(C, -597, '2026-08-22'),
      rep(A, 4412.47, '2026-09-07'), rep(C, -3506.74, '2026-09-07'), rep(A, 629.12, '2026-09-23'), rep(C, -523.2, '2026-09-23'),
      rep(A, 4716.47, '2026-10-07'), rep(C, -3753.29, '2026-10-07'),
    ],
  });
  assertEquals(valores(ciclos), [
    ['2026-04-06', '2026-05-06', 4604.78], ['2026-05-06', '2026-06-06', 4887.1], ['2026-06-06', '2026-07-06', 4934.77],
    ['2026-07-06', '2026-08-06', 5087.19], ['2026-08-06', '2026-09-06', 5166.2], ['2026-09-06', '2026-10-06', 5041.59],
    ['2026-10-06', '2026-11-01', 4716.47],
  ]);
});

Deno.test('ciclos: conta coanfitriã, 20% + limpeza só no 1º (HMZPZNQTHY, R$ 18.658,32)', () => {
  const C = 'Recebimento do coanfitrião';
  const ciclos = computeStayCycles({
    checkIn: '2026-03-01', checkOut: '2026-06-22', commissionRate: 0.2, cleaningFee: 250,
    repasses: [rep(C, 1155.6, '2026-03-02'), rep(C, 1023.19, '2026-04-02'), rep(C, 1034.54, '2026-05-02'), rep(C, 718.33, '2026-06-02')],
  });
  assertEquals(valores(ciclos), [
    ['2026-03-01', '2026-04-01', 4778], ['2026-04-01', '2026-05-01', 5115.95],
    ['2026-05-01', '2026-06-01', 5172.7], ['2026-06-01', '2026-06-22', 3591.65],
  ]);
});

Deno.test('ciclos: ajuste e repasse em duas partes ficam no ciclo certo (HMJ28CAKQA, HMQFRSSJQ3)', () => {
  const A = 'Acomodação';
  assertEquals(valores(computeStayCycles({
    checkIn: '2026-02-05', checkOut: '2026-03-23', commissionRate: 0.2, cleaningFee: 120,
    repasses: [rep(A, 7194.7, '2026-02-06'), rep(A, 2693.91, '2026-03-06'), rep('Ajuste', -1122.67, '2026-03-10')],
  })), [['2026-02-05', '2026-03-05', 7194.7], ['2026-03-05', '2026-03-23', 1571.24]]);

  assertEquals(valores(computeStayCycles({
    checkIn: '2026-03-31', checkOut: '2026-05-02', commissionRate: 0.2, cleaningFee: 120,
    repasses: [rep(A, 1842.64, '2026-04-01'), rep(A, 1580.18, '2026-04-13'), rep(A, 110.37, '2026-05-02')],
  })), [['2026-03-31', '2026-05-01', 3422.82], ['2026-05-01', '2026-05-02', 110.37]]);
});

Deno.test('ciclos: gabarito de 2025 lançado à mão (HMEQ8AH588)', () => {
  const A = 'Acomodação';
  assertEquals(valores(computeStayCycles({
    checkIn: '2025-08-16', checkOut: '2025-10-16', commissionRate: 0.1, cleaningFee: 300,
    repasses: [rep(A, 9103.93, '2025-08-17'), rep(A, 7664.93, '2025-09-17'), rep(A, 1145.34, '2025-09-17')],
  })), [['2025-08-16', '2025-09-16', 9103.93], ['2025-09-16', '2025-10-16', 8810.27]]);
});

Deno.test('ciclos: ciclo sem repasse fica sem valor; repasse repetido conta uma vez', () => {
  const A = 'Acomodação';
  const ciclos = computeStayCycles({
    checkIn: '2026-10-06', checkOut: '2026-12-01', commissionRate: 0.2, cleaningFee: 200,
    repasses: [rep(A, 4716.47, '2026-10-07'), rep(A, 4716.47, '2026-10-07')],
  });
  assertEquals(valores(ciclos), [['2026-10-06', '2026-11-06', 4716.47], ['2026-11-06', '2026-12-01', null]]);
});
