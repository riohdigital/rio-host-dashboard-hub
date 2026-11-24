/**
 * Testes do pagamento pela regra de cada plataforma (stayPayment.ts) e da
 * convivência dele com os comprovantes (NFS-e da Booking, repasse do Airbnb).
 *
 *   deno test supabase/functions/_shared/stayPayment.test.ts
 *
 * Os dados são fictícios. O banco é uma imitação em memória do cliente do
 * Supabase, só com o que estas funções usam.
 */

// deno-lint-ignore-file no-explicit-any

import { assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts';

import { applyBookingInvoice } from './bookingInvoice.ts';
import { reconcileStayCycles } from './stayCycles.ts';
import {
  cabeEmUmCiclo,
  dataDePagamentoDaPlataforma,
  estadiaDaLinha,
  hojeEmBrasilia,
  marcarPagamentosPorRegra,
  notaDoPagamentoPorRegra,
  pagamentoPorRegra,
} from './stayPayment.ts';

const PAGAR = (dataPagamento: string) => ({ pagar: true, dataPagamento });
const NAO = (motivo: string) => ({ pagar: false, motivo });

Deno.test('data de pagamento: a mesma regra do gatilho calculate_payment_date', () => {
  // Airbnb: dia seguinte ao check-in (inclusive na virada do mês).
  assertEquals(dataDePagamentoDaPlataforma({ platform: 'Airbnb', check_in_date: '2026-11-20', check_out_date: '2026-11-23' }), '2026-11-21');
  assertEquals(dataDePagamentoDaPlataforma({ platform: 'Airbnb', check_in_date: '2026-10-31', check_out_date: '2026-11-03' }), '2026-11-01');
  // Booking.com: dia 1º do mês seguinte ao check-out (inclusive na virada do ano).
  assertEquals(dataDePagamentoDaPlataforma({ platform: 'Booking.com', check_in_date: '2026-10-10', check_out_date: '2026-10-15' }), '2026-11-01');
  assertEquals(dataDePagamentoDaPlataforma({ platform: 'Booking.com', check_in_date: '2026-10-28', check_out_date: '2026-11-01' }), '2026-12-01');
  assertEquals(dataDePagamentoDaPlataforma({ platform: 'Booking.com', check_in_date: '2026-12-28', check_out_date: '2026-12-31' }), '2027-01-01');
  // Direto e as demais: dia do check-in.
  assertEquals(dataDePagamentoDaPlataforma({ platform: 'Direto', check_in_date: '2026-11-20', check_out_date: '2026-11-23' }), '2026-11-20');
  assertEquals(dataDePagamentoDaPlataforma({ platform: 'Outra', check_in_date: '2026-11-20', check_out_date: '2026-11-23' }), '2026-11-20');
  assertEquals(dataDePagamentoDaPlataforma({ platform: null, check_in_date: '2026-11-20', check_out_date: '2026-11-23' }), '2026-11-20');
  // Sem a data de que a regra depende, não há data de pagamento.
  assertEquals(dataDePagamentoDaPlataforma({ platform: 'Booking.com', check_in_date: '2026-10-10', check_out_date: null }), null);
  assertEquals(dataDePagamentoDaPlataforma({ platform: 'Airbnb', check_in_date: '', check_out_date: '2026-10-15' }), null);
});

Deno.test('pagamento pela regra: cada plataforma antes, no dia e depois da data', () => {
  const airbnb = {
    platform: 'Airbnb', reservation_status: 'Em Andamento', payment_status: 'Pendente',
    check_in_date: '2026-11-20', check_out_date: '2026-11-23', payment_date: '2026-11-21',
  };
  assertEquals(pagamentoPorRegra(airbnb, '2026-11-20'), NAO('antes_da_data'));
  assertEquals(pagamentoPorRegra(airbnb, '2026-11-21'), PAGAR('2026-11-21'));
  assertEquals(pagamentoPorRegra({ ...airbnb, reservation_status: 'Finalizada' }, '2026-12-15'), PAGAR('2026-11-21'));

  const booking = {
    platform: 'Booking.com', reservation_status: 'Finalizada', payment_status: 'Pendente',
    check_in_date: '2026-10-10', check_out_date: '2026-10-15', payment_date: '2026-11-01',
  };
  assertEquals(pagamentoPorRegra(booking, '2026-10-31'), NAO('antes_da_data'));
  assertEquals(pagamentoPorRegra(booking, '2026-11-01'), PAGAR('2026-11-01'));
  assertEquals(pagamentoPorRegra(booking, '2026-11-23'), PAGAR('2026-11-01'));

  const direto = {
    platform: 'Direto', reservation_status: 'Confirmada', payment_status: 'Pendente',
    check_in_date: '2026-11-20', check_out_date: '2026-11-23', payment_date: '2026-11-20',
  };
  assertEquals(pagamentoPorRegra(direto, '2026-11-19'), NAO('antes_da_data'));
  assertEquals(pagamentoPorRegra(direto, '2026-11-20'), PAGAR('2026-11-20'));
  assertEquals(pagamentoPorRegra(direto, '2026-11-21'), PAGAR('2026-11-20'));

  // A coluna do banco é a fonte: data gravada diferente da regra vale assim mesmo.
  assertEquals(pagamentoPorRegra({ ...direto, payment_date: '2026-11-25' }, '2026-11-23'), NAO('antes_da_data'));
  // Coluna vazia: a regra do gatilho é calculada aqui.
  assertEquals(pagamentoPorRegra({ ...airbnb, payment_date: null }, '2026-11-20'), NAO('antes_da_data'));
  assertEquals(pagamentoPorRegra({ ...airbnb, payment_date: null }, '2026-11-21'), PAGAR('2026-11-21'));
  assertEquals(pagamentoPorRegra({ ...booking, payment_date: null }, '2026-10-31'), NAO('antes_da_data'));
  assertEquals(pagamentoPorRegra({ ...booking, payment_date: null }, '2026-11-01'), PAGAR('2026-11-01'));
  assertEquals(pagamentoPorRegra({ ...direto, payment_date: null }, '2026-11-20'), PAGAR('2026-11-20'));
  assertEquals(pagamentoPorRegra({ ...booking, payment_date: null, check_out_date: '' }, '2026-11-23'), NAO('sem_data'));
});

Deno.test('pagamento pela regra: Atrasado, Pago, Cancelada e outros status não são tocados', () => {
  const r = {
    platform: 'Airbnb', reservation_status: 'Finalizada', payment_status: 'Pendente',
    check_in_date: '2026-11-10', check_out_date: '2026-11-13', payment_date: '2026-11-11',
  };
  assertEquals(pagamentoPorRegra(r, '2026-11-23'), PAGAR('2026-11-11'));

  // "Atrasado" é como o Dono marca que não recebeu.
  assertEquals(pagamentoPorRegra({ ...r, payment_status: 'Atrasado' }, '2026-11-23'), NAO('pagamento_nao_pendente'));
  assertEquals(pagamentoPorRegra({ ...r, payment_status: 'Pago' }, '2026-11-23'), NAO('pagamento_nao_pendente'));
  assertEquals(pagamentoPorRegra({ ...r, payment_status: null }, '2026-11-23'), NAO('pagamento_nao_pendente'));
  assertEquals(pagamentoPorRegra({ ...r, payment_status: 'pendente' }, '2026-11-23'), NAO('pagamento_nao_pendente'));

  assertEquals(pagamentoPorRegra({ ...r, reservation_status: 'Cancelada' }, '2026-11-23'), NAO('status_da_reserva'));
  assertEquals(pagamentoPorRegra({ ...r, reservation_status: 'Pendente' }, '2026-11-23'), NAO('status_da_reserva'));
  assertEquals(pagamentoPorRegra({ ...r, reservation_status: null }, '2026-11-23'), NAO('status_da_reserva'));
  for (const status of ['Confirmada', 'Em Andamento', 'Finalizada']) {
    assertEquals(pagamentoPorRegra({ ...r, reservation_status: status }, '2026-11-23'), PAGAR('2026-11-11'));
  }
});

Deno.test('pagamento pela regra: quem desfez à mão não é marcado de novo para a mesma data', () => {
  const r = {
    platform: 'Direto', reservation_status: 'Finalizada', payment_status: 'Pendente',
    check_in_date: '2026-11-10', check_out_date: '2026-11-13', payment_date: '2026-11-10',
    automation_metadata: { pagamento_automatico: { regra: 'data_da_plataforma', em: '2026-11-10T03:30:00.000Z', data_pagamento: '2026-11-10' } },
  };
  assertEquals(pagamentoPorRegra(r, '2026-11-23'), NAO('desfeito_a_mao'));
  // A data de pagamento mudou (as datas da reserva mudaram): a regra volta a valer.
  assertEquals(pagamentoPorRegra({ ...r, check_in_date: '2026-11-12', payment_date: '2026-11-12' }, '2026-11-23'), PAGAR('2026-11-12'));
});

Deno.test('estadia longa do Airbnb: só a linha que cabe em um ciclo é paga pela regra', () => {
  const base = { platform: 'Airbnb', reservation_status: 'Em Andamento', payment_status: 'Pendente' };

  // 28 noites: um repasse só, regra normal.
  const curta = { ...base, check_in_date: '2026-04-06', check_out_date: '2026-05-04', payment_date: '2026-04-07' };
  assertEquals(pagamentoPorRegra(curta, '2026-04-07'), PAGAR('2026-04-07'));

  // 30 noites dentro de um ciclo (06/04 → 06/05): também é um repasse só.
  const umCiclo = { ...base, check_in_date: '2026-04-06', check_out_date: '2026-05-06', payment_date: '2026-04-07' };
  assertEquals(pagamentoPorRegra(umCiclo, '2026-04-07'), PAGAR('2026-04-07'));

  // 95 noites em uma linha só (ainda não dividida): fica para o aviso de repasse,
  // mesmo meses depois.
  const inteira = { ...base, check_in_date: '2026-04-06', check_out_date: '2026-07-10', payment_date: '2026-04-07' };
  assertEquals(pagamentoPorRegra(inteira, '2026-04-07'), NAO('estadia_longa_sem_ciclos'));
  assertEquals(pagamentoPorRegra({ ...inteira, reservation_status: 'Finalizada' }, '2026-11-23'), NAO('estadia_longa_sem_ciclos'));
  // Outra plataforma não tem ciclo mensal: vale a data dela.
  assertEquals(
    pagamentoPorRegra({ ...inteira, platform: 'Booking.com', payment_date: '2026-08-01' }, '2026-08-01'),
    PAGAR('2026-08-01'),
  );

  // Já dividida: a linha do 2º ciclo (06/05 → 06/06) é paga no dia seguinte ao início dele.
  const estadia = { checkIn: '2026-04-06', checkOut: '2026-07-10' };
  const ciclo2 = { ...base, check_in_date: '2026-05-06', check_out_date: '2026-06-06', payment_date: '2026-05-07' };
  assertEquals(pagamentoPorRegra(ciclo2, '2026-05-06', estadia), NAO('antes_da_data'));
  assertEquals(pagamentoPorRegra(ciclo2, '2026-05-07', estadia), PAGAR('2026-05-07'));
  // Último ciclo, mais curto (06/07 → 10/07).
  const ciclo4 = { ...base, check_in_date: '2026-07-06', check_out_date: '2026-07-10', payment_date: '2026-07-07' };
  assertEquals(pagamentoPorRegra(ciclo4, '2026-07-07', estadia), PAGAR('2026-07-07'));
  // Parcela que cobre dois ciclos (06/06 → 10/07): o segundo ainda não foi pago no D+1.
  const doisCiclos = { ...base, check_in_date: '2026-06-06', check_out_date: '2026-07-10', payment_date: '2026-06-07' };
  assertEquals(pagamentoPorRegra(doisCiclos, '2026-06-07', estadia), NAO('estadia_longa_sem_ciclos'));
  // Divisão à mão fora das fronteiras (06/04 → 30/04 cabe no 1º ciclo; 30/04 → 10/06 não cabe em nenhum).
  assertEquals(cabeEmUmCiclo({ check_in_date: '2026-04-06', check_out_date: '2026-04-30' }, estadia), true);
  assertEquals(cabeEmUmCiclo({ check_in_date: '2026-04-30', check_out_date: '2026-06-10' }, estadia), false);

  // A estadia inteira são as linhas do código que se encostam; a separada por um intervalo é outra.
  const linha = { check_in_date: '2026-05-06', check_out_date: '2026-06-06' };
  assertEquals(
    estadiaDaLinha(linha, [
      { check_in_date: '2026-06-06', check_out_date: '2026-07-10' },
      { check_in_date: '2026-04-06', check_out_date: '2026-05-06' },
      { check_in_date: '2026-09-01', check_out_date: '2026-09-05' },
    ]),
    estadia,
  );
  assertEquals(estadiaDaLinha(linha), { checkIn: '2026-05-06', checkOut: '2026-06-06' });
});

Deno.test('pagamento pela regra: o dia vira à meia-noite de Brasília, não à de UTC', () => {
  // 02:59 UTC do dia 24 ainda é dia 23 em Brasília; 03:00 UTC já é dia 24.
  assertEquals(hojeEmBrasilia(new Date('2026-11-24T02:59:00Z')), '2026-11-23');
  assertEquals(hojeEmBrasilia(new Date('2026-11-24T03:00:00Z')), '2026-11-24');

  const booking = {
    platform: 'Booking.com', reservation_status: 'Finalizada', payment_status: 'Pendente',
    check_in_date: '2026-11-20', check_out_date: '2026-11-25', payment_date: '2026-12-01',
  };
  assertEquals(pagamentoPorRegra(booking, hojeEmBrasilia(new Date('2026-12-01T02:59:00Z'))), NAO('antes_da_data'));
  assertEquals(pagamentoPorRegra(booking, hojeEmBrasilia(new Date('2026-12-01T03:00:00Z'))), PAGAR('2026-12-01'));

  const airbnb = {
    platform: 'Airbnb', reservation_status: 'Em Andamento', payment_status: 'Pendente',
    check_in_date: '2026-11-22', check_out_date: '2026-11-25', payment_date: '2026-11-23',
  };
  assertEquals(pagamentoPorRegra(airbnb, hojeEmBrasilia(new Date('2026-11-23T02:30:00Z'))), NAO('antes_da_data'));
  assertEquals(pagamentoPorRegra(airbnb, hojeEmBrasilia(new Date('2026-11-23T03:30:00Z'))), PAGAR('2026-11-23'));
});

Deno.test('marca da regra na observação: acrescenta sem apagar e não repete', () => {
  assertEquals(notaDoPagamentoPorRegra(null, '2026-11-21'), '[Pago pela data da plataforma — 2026-11-21]');
  assertEquals(
    notaDoPagamentoPorRegra('Conferida pela IA.', '2026-11-21'),
    'Conferida pela IA. [Pago pela data da plataforma — 2026-11-21]',
  );
  assertEquals(
    notaDoPagamentoPorRegra('Conferida pela IA. [Pago pela data da plataforma — 2026-11-21]', '2026-11-25'),
    'Conferida pela IA. [Pago pela data da plataforma — 2026-11-25]',
  );
});

// ---------------------------------------------------------------------------
// Imitação em memória do cliente do Supabase: filtros, ordem, limite, leitura
// de uma linha, update e insert, do jeito que as funções acima usam.
// ---------------------------------------------------------------------------

function bancoFalso(tabelas: Record<string, any[]>) {
  const gravacoes: Array<{ tabela: string; acao: string; valores: any }> = [];

  const from = (tabela: string) => {
    const linhas = (tabelas[tabela] ??= []);
    const filtros: Array<(r: any) => boolean> = [];
    let acao: 'select' | 'update' | 'insert' = 'select';
    let valores: any = null;
    let ordem: { coluna: string; crescente: boolean } | null = null;
    let limite = Infinity;
    let umaLinha = false;

    const compara = (operador: string, atual: any, valor: string): boolean => {
      if (operador === 'is') return valor === 'null' ? atual === null || atual === undefined : false;
      if (atual === null || atual === undefined) return false;
      if (operador === 'lte') return String(atual) <= valor;
      if (operador === 'gte') return String(atual) >= valor;
      if (operador === 'eq') return String(atual) === valor;
      throw new Error(`operador não imitado: ${operador}`);
    };

    const executar = () => {
      if (acao === 'insert') {
        const nova = { id: `novo-${linhas.length + 1}`, ...valores };
        linhas.push(nova);
        gravacoes.push({ tabela, acao, valores });
        return { data: umaLinha ? nova : [nova], error: null };
      }
      let achadas = linhas.filter((r) => filtros.every((f) => f(r)));
      if (acao === 'update') {
        for (const r of achadas) Object.assign(r, valores);
        if (achadas.length) gravacoes.push({ tabela, acao, valores });
        return { data: achadas.map((r) => ({ ...r })), error: null };
      }
      if (ordem) {
        const { coluna, crescente } = ordem;
        achadas = [...achadas].sort((a, b) => String(a[coluna]).localeCompare(String(b[coluna])) * (crescente ? 1 : -1));
      }
      achadas = achadas.slice(0, limite).map((r) => ({ ...r }));
      return { data: umaLinha ? (achadas[0] ?? null) : achadas, error: null };
    };

    const consulta: any = {
      select: () => consulta,
      update: (v: any) => { acao = 'update'; valores = v; return consulta; },
      insert: (v: any) => { acao = 'insert'; valores = v; return consulta; },
      eq: (c: string, v: any) => { filtros.push((r) => r[c] === v); return consulta; },
      in: (c: string, vs: any[]) => { filtros.push((r) => vs.includes(r[c])); return consulta; },
      gte: (c: string, v: string) => { filtros.push((r) => compara('gte', r[c], v)); return consulta; },
      lte: (c: string, v: string) => { filtros.push((r) => compara('lte', r[c], v)); return consulta; },
      or: (expressao: string) => {
        const partes = expressao.split(',').map((p) => {
          const [coluna, operador, ...resto] = p.split('.');
          return { coluna, operador, valor: resto.join('.') };
        });
        filtros.push((r) => partes.some((p) => compara(p.operador, r[p.coluna], p.valor)));
        return consulta;
      },
      order: (coluna: string, opcoes: { ascending?: boolean } = {}) => {
        ordem = { coluna, crescente: opcoes.ascending !== false };
        return consulta;
      },
      limit: (n: number) => { limite = n; return consulta; },
      maybeSingle: () => { umaLinha = true; return consulta; },
      single: () => { umaLinha = true; return consulta; },
      then: (ok: any, falha: any) => Promise.resolve().then(executar).then(ok, falha),
    };
    return consulta;
  };

  return { from, tabelas, gravacoes };
}

const AGORA = new Date('2026-11-23T15:00:00Z'); // 12:00 de 23/11 em Brasília

function reservasDeTeste(): any[] {
  const linha = (id: string, campos: Record<string, unknown>) => ({
    id, property_id: 'imovel-1', reservation_status: 'Finalizada', payment_status: 'Pendente',
    total_revenue: 500, automation_metadata: null, verification_notes: null, ...campos,
  });
  return [
    // Devem virar "Pago".
    linha('airbnb-vencida', {
      platform: 'Airbnb', reservation_code: 'HMTESTE001', check_in_date: '2026-11-10', check_out_date: '2026-11-13', payment_date: '2026-11-11',
      automation_metadata: { email_subject: 'Reserva confirmada', repasses: [{ tipo: 'Cota do coanfitrião', valor: -80, liberado_em: '2026-11-11' }] },
      verification_notes: 'Conferida pela IA.',
    }),
    linha('airbnb-hoje', {
      platform: 'Airbnb', reservation_code: 'HMTESTE002', reservation_status: 'Em Andamento',
      check_in_date: '2026-11-22', check_out_date: '2026-11-26', payment_date: '2026-11-23',
    }),
    linha('booking-vencida', {
      platform: 'Booking.com', reservation_code: '5000000001', check_in_date: '2026-10-10', check_out_date: '2026-10-15', payment_date: '2026-11-01',
    }),
    linha('direto-hoje', {
      platform: 'Direto', reservation_code: 'DIR-1', reservation_status: 'Confirmada',
      check_in_date: '2026-11-23', check_out_date: '2026-11-25', payment_date: '2026-11-23',
    }),
    linha('sem-data', {
      platform: 'Airbnb', reservation_code: 'HMTESTE003', check_in_date: '2026-11-05', check_out_date: '2026-11-08', payment_date: null,
    }),
    // Estadia longa já dividida: o 2º ciclo, lançado à mão, vence em 07/11.
    linha('longa-ciclo-1', {
      platform: 'Airbnb', reservation_code: 'HMTESTE004', payment_status: 'Pago',
      check_in_date: '2026-10-06', check_out_date: '2026-11-06', payment_date: '2026-10-07',
    }),
    linha('longa-ciclo-2', {
      platform: 'Airbnb', reservation_code: 'HMTESTE004', reservation_status: 'Em Andamento',
      check_in_date: '2026-11-06', check_out_date: '2026-12-06', payment_date: '2026-11-07',
    }),

    // Não podem ser tocadas.
    linha('airbnb-amanha', {
      platform: 'Airbnb', reservation_code: 'HMTESTE005', reservation_status: 'Em Andamento',
      check_in_date: '2026-11-23', check_out_date: '2026-11-26', payment_date: '2026-11-24',
    }),
    linha('booking-mes-que-vem', {
      platform: 'Booking.com', reservation_code: '5000000002', check_in_date: '2026-11-10', check_out_date: '2026-11-15', payment_date: '2026-12-01',
    }),
    linha('atrasada', {
      platform: 'Airbnb', reservation_code: 'HMTESTE006', payment_status: 'Atrasado',
      check_in_date: '2026-11-01', check_out_date: '2026-11-04', payment_date: '2026-11-02',
    }),
    linha('cancelada', {
      platform: 'Booking.com', reservation_code: '5000000003', reservation_status: 'Cancelada',
      check_in_date: '2026-10-01', check_out_date: '2026-10-04', payment_date: '2026-11-01',
    }),
    linha('longa-inteira', {
      platform: 'Airbnb', reservation_code: 'HMTESTE007', reservation_status: 'Em Andamento',
      check_in_date: '2026-09-15', check_out_date: '2026-12-20', payment_date: '2026-09-16',
    }),
    linha('desfeita', {
      platform: 'Direto', reservation_code: 'DIR-2', check_in_date: '2026-11-12', check_out_date: '2026-11-14', payment_date: '2026-11-12',
      automation_metadata: { pagamento_automatico: { regra: 'data_da_plataforma', em: '2026-11-12T03:10:00.000Z', data_pagamento: '2026-11-12' } },
    }),
  ];
}

Deno.test('rodada do cron: marca só o que a regra manda e deixa o rastro, sem perder o que já estava gravado', async () => {
  const banco = bancoFalso({ reservations: reservasDeTeste() });
  const status = () => Object.fromEntries(banco.tabelas.reservations.map((r) => [r.id, r.payment_status]));

  assertEquals(await marcarPagamentosPorRegra(banco, AGORA), { marcadas: 6, aguardandoRepasse: 1 });
  assertEquals(status(), {
    'airbnb-vencida': 'Pago',
    'airbnb-hoje': 'Pago',
    'booking-vencida': 'Pago',
    'direto-hoje': 'Pago',
    'sem-data': 'Pago',
    'longa-ciclo-1': 'Pago',
    'longa-ciclo-2': 'Pago',
    'airbnb-amanha': 'Pendente',
    'booking-mes-que-vem': 'Pendente',
    'atrasada': 'Atrasado',
    'cancelada': 'Pendente',
    'longa-inteira': 'Pendente',
    'desfeita': 'Pendente',
  });

  // Rastro: o resto do JSON e da observação continua lá.
  const vencida = banco.tabelas.reservations.find((r) => r.id === 'airbnb-vencida');
  assertEquals(vencida.automation_metadata, {
    email_subject: 'Reserva confirmada',
    repasses: [{ tipo: 'Cota do coanfitrião', valor: -80, liberado_em: '2026-11-11' }],
    pagamento_automatico: { regra: 'data_da_plataforma', em: '2026-11-23T15:00:00.000Z', data_pagamento: '2026-11-11' },
  });
  assertEquals(vencida.verification_notes, 'Conferida pela IA. [Pago pela data da plataforma — 2026-11-11]');
  // Sem `payment_date` no banco, a data do rastro é a calculada pela regra.
  const semData = banco.tabelas.reservations.find((r) => r.id === 'sem-data');
  assertEquals(semData.automation_metadata.pagamento_automatico.data_pagamento, '2026-11-06');

  // Só os três campos são gravados: nenhum valor, data ou status da reserva.
  for (const g of banco.gravacoes) {
    assertEquals(Object.keys(g.valores).sort(), ['automation_metadata', 'payment_status', 'verification_notes']);
  }
  // A linha já paga da estadia longa não é regravada.
  assertEquals(banco.tabelas.reservations.find((r) => r.id === 'longa-ciclo-1').automation_metadata, null);

  // Rodada seguinte: nada a fazer; a estadia longa continua esperando o repasse.
  assertEquals(await marcarPagamentosPorRegra(banco, new Date('2026-11-23T15:30:00Z')), { marcadas: 0, aguardandoRepasse: 1 });
  // No dia seguinte vence a do Airbnb com check-in em 23/11.
  assertEquals(await marcarPagamentosPorRegra(banco, new Date('2026-11-24T03:00:00Z')), { marcadas: 1, aguardandoRepasse: 1 });
  assertEquals(status()['airbnb-amanha'], 'Pago');
});

Deno.test('rodada do cron: mudança feita no meio da rodada não é atropelada', async () => {
  const banco = bancoFalso({ reservations: reservasDeTeste().filter((r) => r.id === 'booking-vencida') });
  // Entre a leitura e a gravação, o Dono marca "Atrasado".
  const original = banco.from;
  let leituras = 0;
  banco.from = (tabela: string) => {
    if (++leituras === 2) banco.tabelas.reservations[0].payment_status = 'Atrasado';
    return original(tabela);
  };
  assertEquals(await marcarPagamentosPorRegra(banco, AGORA), { marcadas: 0, aguardandoRepasse: 0 });
  assertEquals(banco.tabelas.reservations[0].payment_status, 'Atrasado');
  assertEquals(banco.tabelas.reservations[0].automation_metadata, null);
});

Deno.test('NFS-e da Booking depois da regra: a soma continua conferida e a marca da nota entra uma vez', async () => {
  const pelaRegra = { pagamento_automatico: { regra: 'data_da_plataforma', em: '2026-11-01T03:10:00.000Z', data_pagamento: '2026-11-01' } };
  const reserva = (id: string, campos: Record<string, unknown>) => ({
    id, property_id: 'imovel-1', platform: 'Booking.com', reservation_status: 'Finalizada',
    check_in_date: '2026-10-10', check_out_date: '2026-10-15', automation_metadata: null, verification_notes: null, ...campos,
  });
  const banco = bancoFalso({
    channel_sync_sources: [{ property_id: 'imovel-1', platform: 'Booking.com', listing_alias: 'booking_hotel_id:10000001' }],
    reservations: [
      reserva('pela-regra', {
        reservation_code: '5000000001', total_revenue: 1000, payment_status: 'Pago',
        automation_metadata: pelaRegra, verification_notes: '[Pago pela data da plataforma — 2026-11-01]',
      }),
      reserva('a-mao', { reservation_code: '5000000002', total_revenue: 700, payment_status: 'Pago', verification_notes: 'Recebido.' }),
      reserva('pendente', { reservation_code: '5000000003', total_revenue: 300, payment_status: 'Atrasado' }),
      reserva('cancelada', { reservation_code: '5000000004', total_revenue: 900, payment_status: 'Pendente', reservation_status: 'Cancelada' }),
    ],
  });
  const nota = { hotelId: '10000001', vendas: 2300, comissao: 300, mesInicio: '2026-10-01', mesFim: '2026-10-31' };

  // 1000 + 700 + 300 = 2000 = vendas − comissão: fecha, com as reservas já pagas na soma.
  const resultado = await applyBookingInvoice(banco, '7000001', nota);
  assertEquals(resultado, { pagas: 1, confirmadas: 1, divergencia: null, propertyId: 'imovel-1', aprendido: false });

  const linhas = Object.fromEntries(banco.tabelas.reservations.map((r) => [r.id, r]));
  const marca = '[Pago — NFS-e 7000001 da Booking, saídas de 2026-10]';
  assertEquals(linhas['pela-regra'].verification_notes, `[Pago pela data da plataforma — 2026-11-01] ${marca}`);
  assertEquals(linhas['pela-regra'].payment_status, 'Pago');
  assertEquals(linhas['pela-regra'].automation_metadata, pelaRegra);
  // Paga à mão antes da nota: fica como estava (comportamento de sempre).
  assertEquals(linhas['a-mao'].verification_notes, 'Recebido.');
  // A nota é comprovante: marca também a que estava "Atrasado" (comportamento de sempre).
  assertEquals(linhas['pendente'].payment_status, 'Pago');
  assertEquals(linhas['pendente'].verification_notes, marca);
  assertEquals(linhas['cancelada'].payment_status, 'Pendente');

  // A mesma nota reprocessada não repete a marca.
  assertEquals(
    await applyBookingInvoice(banco, '7000001', nota),
    { pagas: 0, confirmadas: 0, divergencia: null, propertyId: 'imovel-1', aprendido: false },
  );
  assertEquals(linhas['pela-regra'].verification_notes, `[Pago pela data da plataforma — 2026-11-01] ${marca}`);

  // Nota que não fecha (diferença acima de R$ 1): a divergência aparece mesmo com tudo já pago.
  const outra = await applyBookingInvoice(banco, '7000002', { ...nota, vendas: 2500 });
  assertEquals(outra.pagas, 0);
  assertEquals(outra.confirmadas, 1);
  assertEquals(
    outra.divergencia,
    'NFS-e 7000002: vendas R$ 2500.00 − comissão R$ 300.00 = R$ 2200.00; dashboard soma R$ 2000.00 em 3 reserva(s) com saída de 2026-10-01 a 2026-10-31.',
  );
});

Deno.test('repasse do Airbnb depois da regra: o valor ainda entra e o rastro fica', async () => {
  const pelaRegra = { regra: 'data_da_plataforma', em: '2026-11-11T03:10:00.000Z', data_pagamento: '2026-11-11' };
  const banco = bancoFalso({
    properties: [{ id: 'imovel-1', commission_rate: 0.2, cleaning_fee: 150 }],
    reservations: [{
      id: 'curta', property_id: 'imovel-1', platform: 'Airbnb', reservation_code: 'HMTESTE001',
      reservation_status: 'Finalizada', payment_status: 'Pago', total_revenue: 0,
      check_in_date: '2026-11-10', check_out_date: '2026-11-13', payment_date: '2026-11-11',
      // Como o `ingest-reservation-email` grava: o repasse entra no JSON, o resto fica.
      automation_metadata: {
        pagamento_automatico: pelaRegra,
        repasses: [{ tipo: 'Acomodação', valor: 812.4, liberado_em: '2026-11-12' }],
      },
      verification_notes: '[Pago pela data da plataforma — 2026-11-11]',
    }],
  });

  assertEquals(await reconcileStayCycles(banco, 'HMTESTE001'), { atualizadas: 1, criadas: 0 });
  const linha = banco.tabelas.reservations[0];
  assertEquals(linha.total_revenue, 812.4);
  assertEquals(linha.payment_status, 'Pago');
  assertEquals(linha.automation_metadata.pagamento_automatico, pelaRegra);

  // Com valor já lançado, o repasse só confirma: nada muda.
  assertEquals(await reconcileStayCycles(banco, 'HMTESTE001'), { atualizadas: 0, criadas: 0 });
});
