import assert from 'node:assert/strict';
import { test } from 'node:test';

import { traduzir } from '../src/comandos.js';
import { origemPermitida, pedidoInterno } from '../src/config.js';
import { passoDoLogin } from '../src/plataformas.js';
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
