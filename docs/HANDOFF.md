# Handoff — coleta automática de reservas

Estado em **29/08/2026**. Tudo descrito aqui está publicado e rodando em
produção, salvo onde marcado como pendente.

---

## O problema e a forma da solução

O dashboard precisava coletar reservas do Airbnb e do Booking.com sem
intervenção manual. As APIs oficiais das duas plataformas só existem para
parceiros de conectividade homologados — não há credencial para o anfitrião.

A solução usa **três fontes oficiais e gratuitas**, cada uma trazendo o que as
outras não têm:

| Fonte | Entrega | Não entrega |
|---|---|---|
| **iCal** (feeds exportados) | datas ocupadas, código do Airbnb | hóspede, valor |
| **E-mail** (transacionais) | hóspede, datas, código, cancelamento | **valor** |
| **Extrato** (exportação de reservas) | **valor**, comissão, hóspede, datas | nada em tempo real |

Nenhuma das três sozinha resolve. O e-mail completa o que o iCal criou; o
extrato completa o dinheiro, que nem o iCal nem o e-mail carregam.

---

## O que está no ar

**Banco** — migração `20260829120000_channel_sync_reservations.sql` aplicada:
`channel_sync_sources`, `channel_sync_runs`, `reservation_sync_pending`, e as
colunas `external_uid`, `external_source`, `last_synced_at` em `reservations`,
com índice único `(property_id, external_uid)`.

**Edge Functions** (deploy automático no merge para `main`):

- `sync-channel-reservations` — lê os feeds iCal. Agendada no Supabase Cron a
  cada 30 min (`Integrations → Cron`), com header `x-sync-secret`.
- `ingest-reservation-email` — recebe e interpreta os e-mails das plataformas.
- `import-platform-statement` — aplica as linhas de um extrato exportado.

**Google Apps Script** (`docs/scripts/gmail-forwarder.gs`), na conta
`rioh.host@gmail.com`, com acionador de 30 min em `sincronizarReservas`.
Funções auxiliares: `sincronizarHistorico` (recupera desde `BACKFILL_DESDE`),
`reprocessarTudo` (devolve tudo à fila e reavalia), `testarSemGravar`.

**Front** — *Configurações → Sincronização de Reservas*: calendários, fila de
conferência, histórico de execuções e importação de extrato.

**Configuração** — 5 imóveis, 10 feeds iCal, secret `CHANNEL_SYNC_SECRET`
cadastrado, extensões `pg_cron` e `pg_net` ativas.

---

## O que ainda falta

1. **Importar os extratos.** Os arquivos do usuário foram lidos e conferidos,
   mas a importação ainda não foi concluída: Booking Copacabana (6 reservas,
   R$ 10.022,35 líquido), Booking Lapa (5, R$ 5.633,54), Airbnb (10). Sem isso
   as reservas seguem com `total_revenue = 0`.
2. **Uma pendência de e-mail irredutível**: código `5000446589` (22/07, Lapa).
   Tem código, imóvel e data de entrada; o check-out não existe em nenhum
   e-mail recebido. Preenchimento manual.
3. **Reservas antigas do Airbnb** (8 registros criados pelo iCal) continuam sem
   hóspede e sem valor: os e-mails do Airbnb iam para o iCloud, não para o
   Gmail. O extrato resolve o valor; o nome do hóspede vem no mesmo arquivo.
4. **Conferir a fila de pendências** — a maioria é do Booking, cujo feed não
   distingue reserva de bloqueio manual.

---

## Decisões que valem preservar

**Receita Total = líquido recebido**, não o preço cheio. O dashboard não
desconta taxa de plataforma: ele reparte o líquido entre a comissão do gestor,
a do proprietário e a faxineira. Para o Booking isso é `Price − Commission
Amount`; para o Airbnb, a coluna `Valor`. A comissão da plataforma é guardada
apenas como referência em `automation_metadata`, **nunca** em
`commission_amount` (que é calculado pelo trigger a partir da taxa do imóvel).

**A sincronização nunca sobrescreve trabalho manual.** Cria o que falta,
preenche apenas campos vazios, atualiza datas (a plataforma é a fonte da
verdade nisso) e **nunca cancela sozinha** — reserva sumida do feed vira
pendência.

**Identificação da propriedade**, da pista mais forte à mais fraca
(`_shared/propertyMatching.ts`): `hotel_id` do Booking → apelido do anúncio →
nome da propriedade citado → semelhança de título (corte 0,6 com margem de
0,15) → imóvel único. O que não resolve vira pergunta na tela, e a resposta é
aprendida.

---

## Armadilhas descobertas nos dados reais

Todas custaram tempo. Não as redescubra.

**O calendário do Booking não distingue reserva de bloqueio.** Todo período
ocupado sai como `CLOSED - Not available`. Por isso todo evento novo do Booking
também vira item de conferência.

**Calendários cruzados duplicam estadias.** Quem conecta o Airbnb ao Booking
(e vice-versa) faz a mesma reserva aparecer nos dois feeds. Regras: evento do
Airbnb sem código não vira reserva (reserva real do Airbnb sempre traz a URL na
descrição); evento do Booking sobre período já ocupado é descartado;
sobreposição apenas parcial vira conflito para conferência. Os feeds do Airbnb
são lidos antes dos do Booking dentro de cada execução.

**Back-to-back não é conflito.** Check-out é dia livre: sair e entrar no mesmo
dia é normal.

**O assunto do "Nova reserva!" do Booking não tem o nome do hóspede.** O
formato é `(CÓDIGO, dia da semana, data)`. Tentar extrair nome dali produzia
lixo (`(6859442149`, `feira` de "quarta-feira"). Em compensação, **a data de
entrada está ali** e é lida de lá quando o corpo não a traz.

**O `hotel_id` do Booking está no `href`, não no texto visível**, e alguma
cópia do link pode chegar truncada (`1410` em vez de `14107413`) — vale a
ocorrência mais longa. Conhecidos: `14107413` = Copacabana, `14463427` = Lapa.

**As plataformas mandam muito mais e-mail do que confirmação de reserva.**
Mensagem sem código **e** sem datas é descartada; sem isso a fila de
conferência enche de newsletter.

**No extrato do Airbnb, uma reserva ocupa várias linhas.** Estadias longas são
pagas em parcelas mensais e ajustes vêm à parte — os valores são somados por
código. Linhas de `Payout` e `Recebimento do coanfitrião` ficam de fora.

**As datas do Airbnb são MM/DD/AAAA e o SheetJS as destrói.** Com formatação
ligada ele reescreve `08/22/2026` como `8/22/26`. A leitura usa `raw: true`.

**Valores misturam convenções decimais.** O Booking exporta `56.784 BRL`
(ponto decimal, três casas — é 13% de 436,80, não 56 mil); o Airbnb exporta
`1.030,79` no padrão brasileiro. Vale o último separador como decimal. O
arquivo do Booking traz o percentual de comissão, então a importação confere se
a comissão bate com o preço e destaca o que não fecha.

**Os nomes de coluna chegam com acentuação variável** conforme a codificação —
são comparados sem acento nem caixa.

---

## Como diagnosticar

Comece pela tela: *Configurações → Sincronização de Reservas* mostra o estado
de cada calendário, a fila de conferência e as últimas execuções, com contagem
de criadas/atualizadas/pendentes.

Depois, o registro do Apps Script (Execuções) mostra o que cada e-mail virou,
com o motivo linha a linha.

Consultas úteis — **peça ao usuário para rodá-las e colar o resultado**:

```sql
-- Tudo que a automação criou ou tocou
SELECT COALESCE(p.nickname, p.name) AS propriedade, r.platform,
       r.reservation_code, r.guest_name, r.total_revenue,
       r.check_in_date, r.check_out_date, r.external_source, r.last_synced_at
FROM reservations r
LEFT JOIN properties p ON p.id = r.property_id
WHERE r.external_source IS NOT NULL
ORDER BY propriedade, r.check_in_date;

-- Configuração dos calendários, com os nomes de anúncio aprendidos
SELECT COALESCE(p.nickname, p.name) AS propriedade, s.platform,
       s.is_active, s.listing_alias, s.last_sync_status, s.last_sync_at
FROM channel_sync_sources s
LEFT JOIN properties p ON p.id = s.property_id
ORDER BY propriedade, s.platform;

-- Últimas execuções
SELECT started_at, channel, platform, status, reservations_created,
       reservations_updated, pending_created, message
FROM channel_sync_runs ORDER BY started_at DESC LIMIT 20;

-- Fila de conferência aberta
SELECT kind, platform, summary, created_at
FROM reservation_sync_pending WHERE status = 'pending'
ORDER BY created_at DESC;
```

Script de limpeza, caso apareçam duplicatas de calendário cruzado:
[`sql/limpar-reservas-espelhadas.sql`](sql/limpar-reservas-espelhadas.sql).

---

## Erros cometidos nesta sessão

Registrados para não se repetirem:

1. **Afirmei que imóveis não estavam cadastrados** com base numa consulta
   antiga que listava só propriedades **com reserva**. Era uma dedução, não um
   fato, e estava errada. O ambiente não alcança o Supabase: quando precisar de
   dado do banco, peça.
2. **Publiquei uma quebra em produção** (`checkIn` usado antes da declaração)
   porque as Edge Functions não tinham typecheck. Corrigido com
   `supabase/functions/tsconfig.json`, rodando também no workflow.
3. **O passo de verificação que adicionei bloqueou o próprio deploy da
   correção** (`npx typescript tsc` em vez de `npx --package typescript --
   tsc`). Sempre confirmar o resultado do workflow antes de pedir um teste.
4. **A importação não dizia por que não gravava** — limpava a tela e anunciava
   sucesso. Resultado que não grava nada precisa explicar cada linha.

---

## Documentação relacionada

- [`SINCRONIZACAO-AUTOMATICA.md`](SINCRONIZACAO-AUTOMATICA.md) — como funciona
  e por que as APIs oficiais não servem.
- [`PASSO-A-PASSO-ATIVACAO.md`](PASSO-A-PASSO-ATIVACAO.md) — ativação pelo
  navegador, sem terminal.
- [`scripts/gmail-forwarder.gs`](scripts/gmail-forwarder.gs) — encaminhador do
  Gmail.
- [`sql/agendar-sincronizacao.sql`](sql/agendar-sincronizacao.sql) —
  agendamento alternativo por SQL.
