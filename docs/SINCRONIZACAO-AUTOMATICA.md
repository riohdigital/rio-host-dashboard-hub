# Coleta automática de reservas (Airbnb + Booking.com)

Este documento explica **por que** as APIs oficiais não resolvem, **quais**
caminhos existem hoje e **como** ligar a solução que foi implementada aqui.

---

## 1. O que foi investigado

| Caminho | Situação real | Serve? |
|---|---|---|
| **API oficial do Airbnb** | Só existe para *Software Partners* homologados (channel managers e PMS). Não há credencial para anfitrião individual. | ❌ |
| **Booking.com Connectivity API** | Idem: exige contrato de parceiro de conectividade + certificação técnica. A "Demand API" é para revenda, não para o dono do imóvel. | ❌ |
| **Scraping do extranet / painel do anfitrião** | Quebra a cada mudança de layout, esbarra em 2FA e CAPTCHA, e fere os termos de uso das duas plataformas. | ❌ |
| **Channel manager de terceiros** (Hostaway, Guesty, Beds24…) | Funciona, mas é exatamente o tipo de serviço que este projeto já é — pagar por ele é redundante. | ❌ |
| **Exportação iCal (.ics)** | Oficial, gratuita, estável e suportada pelas duas plataformas. Entrega datas ocupadas. | ✅ (parcial) |
| **E-mails transacionais das plataformas** | Chegam sempre, são seus, e contêm hóspede, valor, comissão e cancelamento. | ✅ (complemento) |

### A limitação central do iCal

O Airbnb removeu os dados do hóspede dos feeds em **1º de dezembro de 2019**.
Desde então, o `DESCRIPTION` de cada evento traz apenas a URL da reserva e os
**últimos 4 dígitos** do telefone — sem nome, sem valor. O feed também exporta
**somente datas futuras**.

O Booking.com é ainda mais restrito: o feed exportado marca os períodos apenas
como `CLOSED - Not available`, sem distinguir reserva de bloqueio manual e sem
qualquer dado comercial.

**Conclusão:** iCal sozinho não coleta "reservas", coleta "datas ocupadas". Por
isso a solução aqui usa **dois canais complementares**.

---

## 2. Arquitetura implementada

```
                  ┌──────────────────────────┐
   Airbnb  ──────►│  feed iCal (.ics)        │──┐
   Booking ──────►│  feed iCal (.ics)        │  │   datas, bloqueios,
                  └──────────────────────────┘  │   código do Airbnb
                                                ▼
                                   ┌────────────────────────────┐
                                   │ sync-channel-reservations  │
                                   │ (Edge Function + cron)     │
                                   └────────────┬───────────────┘
                                                │
                                                ▼
   Airbnb  ──────┐                     ┌─────────────────┐
   Booking ──────┤ e-mails de reserva  │  reservations   │
                 ▼                     └─────────────────┘
      ┌──────────────────────┐                  ▲
      │ Gmail (Apps Script)  │                  │  hóspede, valor,
      │ ou Cloudflare Email  │──────────────────┘  comissão, cancelamento
      └──────────┬───────────┘
                 ▼
      ┌────────────────────────────┐
      │ ingest-reservation-email   │
      │ (Edge Function)            │
      └────────────────────────────┘
```

**Canal 1 — iCal (esqueleto).** `sync-channel-reservations` lê os feeds a cada
30 minutos, cria a reserva com as datas corretas e guarda o `UID` do evento
para nunca duplicar.

**Canal 2 — e-mail (carne).** `ingest-reservation-email` recebe os e-mails das
plataformas, extrai hóspede/valor/comissão e **completa** a reserva que o iCal
já criou, casando por código de reserva ou por propriedade + data de check-in.

### Regras de segurança dos dados

A sincronização foi escrita para nunca atropelar trabalho manual:

- **Cria** o que não existe.
- **Completa** apenas campos vazios (nome, valor, telefone, nº de hóspedes).
- **Atualiza** datas — nisso a plataforma é a fonte da verdade.
- **Nunca cancela sozinha.** Reserva que sumiu do feed vira um item em
  *Precisam da sua conferência*, em Configurações.
- **Nunca duplica**: índice único `(property_id, external_uid)` no banco.

---

## 3. Configuração passo a passo

### 3.1 Aplicar a migração

```bash
supabase db push
```

Cria `channel_sync_sources`, `channel_sync_runs`, `reservation_sync_pending` e
as colunas `external_uid`, `external_source` e `last_synced_at` em
`reservations`.

### 3.2 Criar o segredo compartilhado

Gere um valor aleatório e cadastre no Supabase:

```bash
openssl rand -hex 32
supabase secrets set CHANNEL_SYNC_SECRET=<valor_gerado>
```

Esse segredo autentica o cron e o encaminhador de e-mails. Sem ele, as funções
só aceitam usuários logados no app.

### 3.3 Publicar as funções

```bash
supabase functions deploy sync-channel-reservations
supabase functions deploy ingest-reservation-email
```

### 3.4 Pegar os links iCal

**Airbnb** → *Calendário* → escolha o anúncio → *Disponibilidade* →
*Sincronizar calendários* → *Exportar calendário* → copie a URL
(`https://www.airbnb.com.br/calendar/ical/<id>.ics?s=<token>`).

**Booking.com** → *Extranet* → *Tarifas e Disponibilidade* →
*Sincronizar calendários* → *Exportar calendário* → copie a URL.

> Esses links contêm um token secreto. Quem tiver a URL enxerga sua ocupação —
> trate como senha.

### 3.5 Cadastrar no dashboard

No app: **Configurações → Sincronização de Reservas → Conectar**. Escolha a
propriedade, a plataforma e cole o link. Preencha também o **nome do anúncio na
plataforma** — é ele que permite identificar a propriedade certa nos e-mails
quando você tem vários imóveis.

Use **Sincronizar agora** para testar imediatamente.

### 3.6 Agendar a leitura automática

Rode `docs/sql/agendar-sincronizacao.sql` no SQL Editor do Supabase (usa
`pg_cron` + `pg_net`, ambos inclusos no plano gratuito).

Sem `pg_cron`, qualquer agendador externo gratuito resolve — basta um POST:

```bash
curl -X POST \
  -H "x-sync-secret: $CHANNEL_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' \
  https://cwcauobnbmzjpqjmmomc.supabase.co/functions/v1/sync-channel-reservations
```

### 3.7 Ligar o canal de e-mail

#### Opção A — Gmail + Apps Script (recomendada, 100% gratuita)

1. Abra <https://script.google.com> e crie um projeto.
2. Cole `docs/scripts/gmail-forwarder.gs`.
3. Ajuste `SYNC_SECRET` com o valor do passo 3.2.
4. Rode `configurar()` e autorize o acesso ao Gmail.
5. Rode `testarSemGravar()` e confira no log o que foi extraído.
6. Crie um acionador de tempo para `sincronizarReservas` a cada 5–10 minutos.

O script marca cada mensagem com o rótulo `RioHost/Processado`, então nenhum
e-mail é enviado duas vezes. Se o POST falhar, o rótulo não é aplicado e a
execução seguinte tenta de novo.

#### Opção B — Cloudflare Email Routing (gratuita, exige domínio próprio)

Crie uma regra de roteamento para um Email Worker:

```js
export default {
  async email(message, env) {
    const raw = new Response(message.raw);
    await fetch(env.INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-secret': env.SYNC_SECRET,
      },
      body: JSON.stringify({
        from: message.from,
        subject: message.headers.get('subject'),
        text: await raw.text(),
      }),
    });
  },
};
```

Depois, no Gmail/Outlook, crie um filtro que encaminhe automaticamente os
e-mails de `airbnb.com` e `booking.com` para esse endereço.

#### Opção C — n8n, Make ou Zapier

Qualquer gatilho de e-mail seguido de um HTTP Request POST para
`ingest-reservation-email` funciona. O corpo aceito é:

```json
{
  "from": "noreply@booking.com",
  "subject": "Nova reserva confirmada - 4821956733",
  "html": "<html>...</html>",
  "text": "versão texto",
  "messageId": "id-unico-opcional",
  "propertyId": "uuid-opcional-para-forçar-a-propriedade",
  "dryRun": false
}
```

Envie até 50 de uma vez usando `{ "emails": [ ... ] }`.

---

## 4. O que cada canal entrega

| Dado | iCal Airbnb | iCal Booking | E-mail |
|---|:---:|:---:|:---:|
| Datas de check-in/check-out | ✅ | ✅ | ✅ |
| Código da reserva | ✅ | ❌ | ✅ |
| Nome do hóspede | ❌ | ❌ | ✅ |
| Valor total | ❌ | ❌ | ✅ |
| Comissão | ❌ | ❌ | ✅ (Booking) |
| Nº de hóspedes | ❌ | ❌ | ✅ |
| Telefone | 4 dígitos | ❌ | ✅ (quando o e-mail traz) |
| Cancelamento | indireto | indireto | ✅ |

Reservas criadas só pelo iCal nascem com `total_revenue = 0` e código
provisório no formato `SYNC-XXXXXXX`. Quando o e-mail correspondente chega, o
código provisório é substituído pelo real e o valor é preenchido.

Como o feed do Booking.com não distingue reserva de bloqueio manual, todo
período novo vindo dele entra também na fila *Precisam da sua conferência*.

---

## 5. Verificação e diagnóstico

**Configurações → Sincronização de Reservas** mostra:

- estado de cada calendário e a última leitura;
- fila de itens ambíguos (propriedade não identificada, dados incompletos,
  possível cancelamento);
- histórico das últimas 30 execuções, com contagem de criadas/atualizadas.

Consultas úteis no SQL Editor:

```sql
-- Últimas execuções
SELECT started_at, channel, platform, status, reservations_created,
       reservations_updated, pending_created, message
FROM channel_sync_runs
ORDER BY started_at DESC
LIMIT 20;

-- Reservas que vieram da automação
SELECT reservation_code, platform, check_in_date, guest_name,
       total_revenue, external_source, last_synced_at
FROM reservations
WHERE external_source IS NOT NULL
ORDER BY last_synced_at DESC NULLS LAST
LIMIT 50;

-- Reservas do iCal ainda sem dados comerciais
SELECT reservation_code, platform, check_in_date, check_out_date
FROM reservations
WHERE reservation_code LIKE 'SYNC-%'
  AND check_out_date >= CURRENT_DATE;
```

### Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `HTTP 404 ao baixar o feed` | Link revogado ou anúncio despublicado | Exporte o link de novo na plataforma |
| `A resposta não é um arquivo iCal válido` | Copiou o link de importação em vez do de exportação | Use o link que termina em `.ics` |
| Reservas duplicadas | Reserva manual anterior com código diferente | Ajuste o código manualmente; a partir daí o casamento por data resolve |
| E-mails viram "Propriedade não identificada" | Nome do anúncio não preenchido | Preencha *Nome do anúncio na plataforma* na tela de configuração |
| Nada acontece no horário | Cron não agendado | Confira `SELECT * FROM cron.job;` |

---

## 6. Limites conhecidos

- O iCal **não é tempo real**: as plataformas atualizam os feeds em intervalos
  de minutos a algumas horas. Para reagir em segundos só com API oficial de
  parceiro.
- O Airbnb exporta apenas datas futuras — reservas antigas não entram por aqui.
- Os parsers de e-mail são heurísticos. Quando o layout mudar, o e-mail cai na
  fila de conferência em vez de gravar dado errado. Os padrões ficam em
  `supabase/functions/_shared/emailParsers.ts` e os testes em
  `supabase/functions/_shared/parsers.test.ts`.

---

## Fontes

- [Airbnb — Como sincronizar calendários (artigo 99)](https://www.airbnb.com/help/article/99)
- [Booking.com Partner Help — Syncing your calendar to third-party calendars](https://partner.booking.com/en-us/help/rates-availability/extranet-calendar/syncing-your-bookingcom-calendar-third-party-calendars)
- [OwnerRez — mudanças no iCal do Airbnb](https://www.ownerrez.com/forums/general-help/airbnb-ical-change)
- [Rental Ninja — sincronizar Airbnb e Booking sem channel manager](https://try.rental-ninja.com/blog/how-to-sync-your-airbnb-and-booking-com-calendars-without-a-channel-manager-using-ical-avoiding-overbookings)
