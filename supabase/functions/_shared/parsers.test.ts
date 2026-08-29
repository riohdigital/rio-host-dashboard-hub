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
  parseReservationEmail,
} from './emailParsers.ts';
import { datesOverlap } from './reservationSync.ts';
import {
  htmlToText,
  parseDateFlexible,
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
  assertEquals(parsed.totalRevenue, 1850);
  assertEquals(parsed.listingName, 'Apto Vista Mar 302');
  // O nome do hóspede só existe no assunto — o corpo traz o rótulo "Hóspedes".
  assertEquals(parsed.guestName, 'Maria Souza');
  assertEquals(parsed.missing, []);
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
  assertEquals(parsed.totalRevenue, 2400);
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
