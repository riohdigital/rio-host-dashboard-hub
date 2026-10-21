import assert from 'node:assert/strict';
import { test } from 'node:test';

import { traduzir } from '../src/comandos.js';
import { origemPermitida, pedidoInterno } from '../src/config.js';
import { passoDoLogin, pastaDoUsuario, pastaValida } from '../src/plataformas.js';
import { esqueleto, lerCalendarioAirbnb, lerReservaAirbnb, valorBRL } from '../src/extratores.js';
import { urlDoBrowserless } from '../src/sessao.js';

const VIEW = { w: 1280, h: 860 };

test('digitação: cada caractere vira tecla de verdade, inclusive acento e aspas', () => {
  const cmds = traduzir({ t: 'text', v: "a~ç'" }, VIEW);
  const downs = cmds.filter((c) => c.params.type === 'keyDown').map((c) => c.params.text);
  assert.deepEqual(downs, ['a', '~', 'ç', "'"]);
  assert.ok(cmds.every((c) => c.method === 'Input.dispatchKeyEvent'));
});

test('colagem longa vai de uma vez e quebra de linha não vira Enter', () => {
  const longo = 'x'.repeat(80);
  assert.deepEqual(traduzir({ t: 'text', v: longo }, VIEW), [{ method: 'Input.insertText', params: { text: longo } }]);
  assert.deepEqual(traduzir({ t: 'text', v: '\r\n' }, VIEW), []);
});

test('Enter é uma tecla só, com text \\r (envio único do formulário)', () => {
  const cmds = traduzir({ t: 'key', k: 'Enter' }, VIEW);
  assert.equal(cmds.length, 2);
  assert.equal(cmds[0].params.type, 'keyDown');
  assert.equal(cmds[0].params.text, '\r');
  assert.equal(cmds[1].params.type, 'keyUp');
});

test('mouse fica dentro da tela e tecla desconhecida é descartada', () => {
  const [c] = traduzir({ t: 'mouse', a: 'down', x: 5000, y: -3, b: 'left', c: 1 }, VIEW);
  assert.equal(c.params.x, 1280);
  assert.equal(c.params.y, 0);
  assert.deepEqual(traduzir({ t: 'key', k: 'F12' }, VIEW), []);
  assert.deepEqual(traduzir({ t: 'eval', code: 'alert(1)' }, VIEW), []);
  assert.deepEqual(traduzir({ t: 'mouse', a: 'teleport', x: 1, y: 1 }, VIEW), []);
});

test('passo do login: Airbnb só conectado com _aat na área do anfitrião', () => {
  const base = { host: 'www.airbnb.com.br', caminho: '/hosting/reservations', busca: '', senha: false, email: false, codigo: false, captcha: false };
  assert.equal(passoDoLogin('airbnb', base, ['_aat', 'bev']), 'conectado');
  assert.equal(passoDoLogin('airbnb', base, ['bev']), 'carregando');
  assert.equal(passoDoLogin('airbnb', { ...base, caminho: '/login', email: true }, []), 'email');
  assert.equal(passoDoLogin('airbnb', { ...base, caminho: '/login', senha: true }, []), 'senha');
});

test('passo do login: Booking conectado só na extranet com ses=', () => {
  const extranet = { host: 'admin.booking.com', caminho: '/hotel/hoteladmin/extranet_ng/manage/home.html', busca: '?ses=abc&lang=pt-br', senha: false, email: false, codigo: false, captcha: false };
  assert.equal(passoDoLogin('booking', extranet, []), 'conectado');
  assert.equal(passoDoLogin('booking', { ...extranet, busca: '' }, []), 'carregando');
  const conta = { host: 'account.booking.com', caminho: '/sign-in/password', busca: '', senha: true, email: false, codigo: false, captcha: false };
  assert.equal(passoDoLogin('booking', conta, []), 'senha');
  assert.equal(passoDoLogin('booking', { ...conta, senha: false, codigo: true }, []), 'codigo');
  assert.equal(passoDoLogin('booking', { ...conta, captcha: true }, []), 'captcha');
});

test('origem: só o dashboard abre o WebSocket', () => {
  const lista = ['rioh-host-dashboard.lovable.app', '*.lovableproject.com', 'localhost:8080'];
  assert.equal(origemPermitida('https://rioh-host-dashboard.lovable.app', lista), true);
  assert.equal(origemPermitida('https://abc.lovableproject.com', lista), true);
  assert.equal(origemPermitida('http://localhost:8080', lista), true);
  assert.equal(origemPermitida('https://evil.com', lista), false);
  assert.equal(origemPermitida('https://rioh-host-dashboard.lovable.app.evil.com', lista), false);
  assert.equal(origemPermitida(undefined, lista), false);
});

test('Browserless: perfil da plataforma, janela do tamanho da tela e sem stealth', () => {
  const config = {
    browserlessWs: 'ws://extra-apps_browserless:3000', browserlessToken: '', pastaPerfis: '/data/profiles',
    duracaoMaximaMs: 900_000, larguraTela: 1024, alturaTela: 768, idioma: 'pt-BR',
  };
  const url = new URL(urlDoBrowserless(config, 'booking'));
  assert.equal(url.pathname, '/chromium');
  assert.equal(url.searchParams.get('token'), null);
  const launch = JSON.parse(url.searchParams.get('launch'));
  assert.equal(launch.headless, false);
  // Com janela de verdade, as "camuflagens" do stealth é que denunciam o robô.
  assert.equal(launch.stealth, false);
  assert.ok(launch.args.includes('--user-data-dir=/data/profiles/booking'));
  assert.ok(launch.args.includes('--window-size=1024,768'));
  assert.ok(launch.args.includes('--lang=pt-BR'));
  assert.equal(new URL(urlDoBrowserless({ ...config, browserlessToken: 'x' }, 'airbnb')).searchParams.get('token'), 'x');
});

test('F7: pasta de perfil por usuário, a antiga continua valendo e nada de caminho livre', () => {
  const id = '9ceae31d-8b83-4da3-818a-aa48252add1e';
  assert.equal(pastaDoUsuario(id, 'airbnb'), `${id}/airbnb`);
  assert.equal(pastaValida(`${id}/airbnb`, 'airbnb'), true);
  assert.equal(pastaValida('airbnb', 'airbnb'), true);
  // Pasta de outra plataforma, subida de diretório e lixo são recusados.
  assert.equal(pastaValida(`${id}/booking`, 'airbnb'), false);
  assert.equal(pastaValida('../booking', 'booking'), false);
  assert.equal(pastaValida(`${id}/../booking`, 'booking'), false);
  assert.equal(pastaValida('', 'airbnb'), false);
  assert.equal(pastaValida(undefined, 'airbnb'), false);
  assert.equal(pastaValida(`${id}/airbnb`, 'vrbo'), false);
  const config = { browserlessWs: 'ws://b:3000', browserlessToken: '', pastaPerfis: '/data/profiles', duracaoMaximaMs: 1, larguraTela: 1024, alturaTela: 768, idioma: 'pt-BR' };
  const launch = JSON.parse(new URL(urlDoBrowserless(config, `${id}/booking`)).searchParams.get('launch'));
  assert.ok(launch.args.includes(`--user-data-dir=/data/profiles/${id}/booking`));
});

test('rota interna: só aceita quem chega pela rede da VPS, nunca pelo Traefik', () => {
  const internos = ['extra-apps_rioh-host-browser-login', 'localhost'];
  assert.equal(pedidoInterno({ headers: { host: 'extra-apps_rioh-host-browser-login:3000' } }, internos), true);
  // Vindo da internet: o Traefik acrescenta X-Forwarded-* e usa o domínio público.
  assert.equal(pedidoInterno({ headers: { host: 'rioh-host-browser-login.dgyrua.easypanel.host', 'x-forwarded-for': '1.2.3.4' } }, internos), false);
  // Host interno forjado, mas passando pelo Traefik: recusado pelo cabeçalho.
  assert.equal(pedidoInterno({ headers: { host: 'extra-apps_rioh-host-browser-login', 'x-forwarded-host': 'x' } }, internos), false);
  assert.equal(pedidoInterno({ headers: { host: 'outro-servico:3000' } }, internos), false);
  assert.equal(pedidoInterno({ headers: {} }, internos), false);
});

// Resposta do StayHostingDetailsQuery no formato real (13/10/2026), com dados fictícios.
function detalheAirbnb({ cabecalho, resumo, entrada, saida, linhas, total, cancelada = false, confirmada = true, hospede = 'Hóspede Teste', extras = 2 }) {
  const item = ([label, formattedValue]) => ({ label, formattedValue });
  return {
    data: { presentation: { hostingDetails: { stayHostingDetails: {
      headerPlacement: [{ sectionId: 'HEADER_SECTION', sectionData: { title: cabecalho } }],
      rootPlacement: [
        { sectionId: 'FACEPILE_SECTION', sectionData: { additionalGuests: extras, guests: [{ name: hospede.split(' ')[0] }] } },
        { sectionId: 'SMART_SUMMARY_SECTION', sectionData: { title: resumo } },
        { sectionId: 'CHECK_IN_CHECK_OUT_SECTION', sectionData: { checkInAction: { checkInTime: entrada, checkOutTime: saida } } },
        { sectionId: 'WHOSCOMING_SECTION', sectionData: { reservationGroups: [{ isCanceled: cancelada, guests: [{ name: hospede }] }] } },
        { sectionId: 'PAYMENTINFO_SECTION', sectionData: { isConfirmed: confirmada, hostEarningsGroup: { groupName: 'Você recebe', lineItems: linhas.map(item), totalLineItem: item(['Total (BRL)', total]) } } },
      ],
    } } } },
  };
}

test('valores em reais: sinal, milhar e centavos', () => {
  assert.equal(valorBRL('R$ 2.598,37'), 2598.37);
  assert.equal(valorBRL('-R$ 14.726,63'), -14726.63);
  assert.equal(valorBRL('R$ 0,00'), 0);
  assert.equal(valorBRL('sem valor'), null);
});

test('Airbnb R1: Total + cota do coanfitrião (exemplo HMZPZNQTHY do documento de regras)', () => {
  const r = lerReservaAirbnb(detalheAirbnb({
    cabecalho: 'Participante anterior', resumo: 'Hóspede', entrada: '2026-03-01T17:00:00.000Z', saida: '2026-06-22T14:00:00.000Z',
    linhas: [['Preço da acomodação para 113 noites', 'R$ 31.780,00'], ['Taxa de limpeza', 'R$ 250,00'], ['Desconto mensal', '-R$ 12.712,00'],
      ['Taxa de serviço do anfitrião (3,0% + IVA)', '-R$ 659,68'], ['Cotas do coanfitrião', '-R$ 14.726,63']],
    total: 'R$ 3.931,69',
  }), 'HMZPZNQTHY');
  assert.equal(r.status, 'success');
  assert.equal(r.total_revenue, 18658.32);
  assert.equal(r.payout_breakdown.cohost_fee, 14726.63);
  assert.equal(r.cleaning_fee, 250);
  assert.equal(r.check_in_date, '2026-03-01');
  assert.equal(r.check_out_date, '2026-06-22');
  assert.equal(r.number_of_nights, 113);
  assert.equal(r.is_multi_month, true);
  assert.equal(r.reservation_status, 'Confirmada');
});

test('Airbnb: reserva sem cota vale o Total; hóspedes e datas em Brasília', () => {
  const r = lerReservaAirbnb(detalheAirbnb({
    cabecalho: 'Chega em 72 dias', resumo: 'Grupo com 3 pessoas', entrada: '2026-12-31T17:00:00.000Z', saida: '2027-01-02T14:00:00.000Z',
    linhas: [['Preço da acomodação para 2 noites', 'R$ 2.885,00'], ['Taxa de limpeza para estadias curtas', 'R$ 117,00'],
      ['Taxa de serviço do anfitrião (16,0% + IVA)', '-R$ 578,63'], ['Taxa de animais de estimação', 'R$ 175,00']],
    total: 'R$ 2.598,37', hospede: 'Maria Teste da Silva',
  }), 'HM825M59DQ');
  assert.equal(r.total_revenue, 2598.37);
  assert.equal(r.cleaning_fee, 117);
  assert.equal(r.number_of_guests, 3);
  assert.equal(r.guest_name, 'Maria Teste da Silva');
  assert.equal(r.is_booking_request_only, false);
  assert.equal(r.is_multi_month, false);
});

test('Airbnb: cancelada pelo hóspede vira Cancelada, com o valor que a plataforma paga', () => {
  const r = lerReservaAirbnb(detalheAirbnb({
    cabecalho: 'Cancelado pelo hóspede', resumo: 'Reserva cancelada', entrada: '2026-10-02T17:00:00.000Z', saida: '2026-10-19T14:00:00.000Z',
    linhas: [['Preço da acomodação para 17 noites', 'R$ 129,40'], ['Taxa de limpeza', 'R$ 120,00'], ['Ajuste de preço por noite', '-R$ 249,40']],
    total: 'R$ 0,00', cancelada: true,
  }), 'HM5B4EB3ST');
  assert.equal(r.reservation_status, 'Cancelada');
  assert.equal(r.total_revenue, 0);
  assert.equal(r.status, 'success');
});

test('Airbnb: resposta sem detalhe não vira sucesso', () => {
  assert.equal(lerReservaAirbnb({ data: {} }, 'HMX').status, 'error');
});

test('esqueleto: só nomes e tipos, nenhum valor', () => {
  const e = esqueleto({ hospede: 'Fulano', valor: 10.5, linhas: [{ a: 'x' }, { a: 'y' }] });
  assert.deepEqual(e, { hospede: 'string', valor: 'number', linhas: [{ a: 'string' }, '×2'] });
  assert.ok(!JSON.stringify(e).includes('Fulano'));
});

test('E4: dias do calendário com preço; bloco sem uma semana de dias é ignorado', () => {
  const dias = Array.from({ length: 10 }, (_, i) => ({
    calendarDate: `2026-11-${String(i + 1).padStart(2, '0')}`,
    available: i % 3 !== 0,
    minNights: 2,
    price: { localPriceFormatted: `R$ ${300 + i},00` },
  }));
  const lidos = lerCalendarioAirbnb({ data: { merlin: { calendarMonths: [{ days: dias }] } } });
  assert.equal(lidos.length, 10);
  assert.deepEqual(lidos[0], { data: '2026-11-01', diaria: 300, disponivel: false, estadia_minima: 2 });
  assert.equal(lidos[9].diaria, 309);
  assert.equal(lerCalendarioAirbnb({ data: { dias: dias.slice(0, 3) } }), null);
  assert.equal(lerCalendarioAirbnb({ data: { nada: true } }), null);
});
