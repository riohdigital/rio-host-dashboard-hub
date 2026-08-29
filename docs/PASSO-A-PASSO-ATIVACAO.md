# Passo a passo para ativar (sem terminal)

Guia clicável. **Você não precisa instalar nada nem usar linha de comando** —
tudo é feito no navegador, em quatro sites:

| Site | Para quê | Link |
|---|---|---|
| GitHub | juntar o código e publicar as funções | <https://github.com/riohdigital/rio-host-dashboard-hub> |
| Supabase | banco de dados e agendamento | <https://supabase.com/dashboard/project/cwcauobnbmzjpqjmmomc> |
| Airbnb / Booking | pegar os links de calendário | — |
| Google Apps Script | ler os e-mails do Gmail | <https://script.google.com> |

Tempo estimado: **30 a 40 minutos**. Faça na ordem — cada etapa depende da anterior.

---

## Etapa 1 — Juntar o código na branch principal

O código novo está numa branch separada. Enquanto ele não for para a `main`,
nada aparece no seu site.

1. Abra: <https://github.com/riohdigital/rio-host-dashboard-hub/pull/new/claude/auto-collect-booking-airbnb-1a1h82>
2. Clique em **Create pull request** (pode deixar o título que já vem).
3. Na tela seguinte, clique em **Merge pull request** e depois em **Confirm merge**.

> O Lovable sincroniza a `main` automaticamente. Em alguns minutos a aba nova
> aparece no seu site, em **Configurações → Sincronização de Reservas**.
> Ela ainda não vai funcionar — falta o banco, que é a próxima etapa.

✅ **Como saber que deu certo:** a branch aparece como *Merged* (roxo) no GitHub.

---

## Etapa 2 — Gerar o segredo de acesso

Esse valor é a "senha" que o agendador e o leitor de e-mails usam para falar
com o sistema. Vamos gerá-lo dentro do próprio Supabase.

1. Abra o **SQL Editor**:
   <https://supabase.com/dashboard/project/cwcauobnbmzjpqjmmomc/sql/new>
2. Cole exatamente isto na caixa de texto:

   ```sql
   SELECT encode(gen_random_bytes(32), 'hex');
   ```

3. Clique em **Run** (ou `Ctrl+Enter`).
4. Vai aparecer um resultado com 64 letras e números, algo como
   `a3f9c1...`. **Copie esse valor e guarde num bloco de notas** — você vai
   usá-lo em três lugares diferentes (etapas 4, 6 e 8).

> ⚠️ Não compartilhe esse valor com ninguém e não cole em e-mail ou chat.

---

## Etapa 3 — Criar as tabelas no banco

1. Abra o arquivo da migração no GitHub:
   <https://github.com/riohdigital/rio-host-dashboard-hub/blob/main/supabase/migrations/20260829120000_channel_sync_reservations.sql>
2. Clique no botão **Copy raw file** (ícone de duas folhinhas, canto superior
   direito do arquivo). Isso copia o conteúdo inteiro.
3. Volte ao **SQL Editor**:
   <https://supabase.com/dashboard/project/cwcauobnbmzjpqjmmomc/sql/new>
4. Apague o que estiver na caixa, **cole** o conteúdo copiado e clique em **Run**.
5. Deve aparecer **Success. No rows returned**.

✅ **Como conferir:** vá em **Table Editor**
(<https://supabase.com/dashboard/project/cwcauobnbmzjpqjmmomc/editor>) e procure
na lista da esquerda por três tabelas novas: `channel_sync_sources`,
`channel_sync_runs` e `reservation_sync_pending`.

> Se der erro dizendo que algo *already exists*, pode ignorar — significa que a
> migração já tinha sido aplicada. O script foi escrito para poder rodar de novo
> sem quebrar nada.

---

## Etapa 4 — Cadastrar o segredo no Supabase

1. Abra: <https://supabase.com/dashboard/project/cwcauobnbmzjpqjmmomc/functions/secrets>

   *(Se essa página não abrir, o caminho pelo menu é: **Project Settings** →
   **Edge Functions** → **Add new secret**.)*

2. Clique em **Add new secret** e preencha:
   - **Key:** `CHANNEL_SYNC_SECRET`
   - **Value:** o valor de 64 caracteres que você guardou na Etapa 2
3. Clique em **Save**.

✅ **Como conferir:** `CHANNEL_SYNC_SECRET` aparece na lista de secrets (o valor
fica escondido, isso é normal).

---

## Etapa 5 — Publicar as duas funções

Primeiro **confira se elas já não estão lá** (o Lovable às vezes publica sozinho):

- Abra <https://supabase.com/dashboard/project/cwcauobnbmzjpqjmmomc/functions>
- Se você já vir `sync-channel-reservations` e `ingest-reservation-email` na
  lista, **pule para a Etapa 6**.

Se não estiverem, publique pelo GitHub:

### 5.1 Gerar o token do Supabase

1. Abra <https://supabase.com/dashboard/account/tokens>
2. Clique em **Generate new token**, dê o nome `github-actions` e clique em
   **Generate token**.
3. **Copie o token agora** — ele só aparece uma vez.

### 5.2 Guardar o token no GitHub

1. Abra: <https://github.com/riohdigital/rio-host-dashboard-hub/settings/secrets/actions/new>
2. **Name:** `SUPABASE_ACCESS_TOKEN`
3. **Secret:** cole o token da etapa anterior.
4. Clique em **Add secret**.

### 5.3 Rodar a publicação

1. Abra: <https://github.com/riohdigital/rio-host-dashboard-hub/actions/workflows/deploy-supabase-functions.yml>
2. Clique no botão **Run workflow** (à direita), deixe a branch `main` e
   confirme clicando em **Run workflow** de novo.
3. Espere ~1 minuto e atualize a página. A execução deve ficar com um ✅ verde.

✅ **Como conferir:** as duas funções aparecem em
<https://supabase.com/dashboard/project/cwcauobnbmzjpqjmmomc/functions>

> Daqui em diante, toda vez que o código das funções mudar na `main`, elas são
> republicadas sozinhas.

---

## Etapa 6 — Agendar a leitura automática dos calendários

### 6.1 Ligar as duas extensões (faça isto ANTES de abrir a tela de cron)

O agendador depende de duas extensões do Postgres que não vêm ligadas por
padrão. Se você pular esta parte, a tela de criação do job dá erro
(`relation "cron.job" does not exist`) ou deixa as opções de HTTP cinzas.

1. Abra: <https://supabase.com/dashboard/project/cwcauobnbmzjpqjmmomc/database/extensions>

   *(Pelo menu: **Database** → **Extensions**.)*

2. Busque por **`pg_cron`** e ligue o botão. Se pedir o schema, aceite o
   sugerido. *(É o motor do agendamento — cria a tabela `cron.job`.)*
3. Busque por **`pg_net`** e ligue também. *(É o que permite ao banco fazer
   chamadas HTTP, necessário para acionar a Edge Function.)*

Alternativa pelo [SQL Editor](https://supabase.com/dashboard/project/cwcauobnbmzjpqjmmomc/sql/new):

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 6.2 Criar o agendamento

1. Abra: <https://supabase.com/dashboard/project/cwcauobnbmzjpqjmmomc/integrations/cron/jobs>

   *(Pelo menu: **Integrations** → **Cron**.)*

2. Clique em **Create job** e preencha:
   - **Name:** `sincronizar-calendarios`
   - **Schedule:** `*/30 * * * *`  *(a cada 30 minutos)*

3. Escolha **Type: Supabase Edge Function** e preencha:
   - **Method:** `POST`
   - **Edge Function:** `sync-channel-reservations`
   - **HTTP Headers:** adicione um header
     - Name: `x-sync-secret`
     - Value: o segredo da Etapa 2
   - **Body:** `{}`
4. Clique em **Create cron job**.

> O aviso *Schedule (GMT)* na tela não é problema: `*/30 * * * *` é um intervalo
> ("a cada 30 minutos"), não um horário fixo, então o fuso não muda nada.

Se a sua tela de Cron não tiver o campo de headers, use o caminho alternativo:
abra o **SQL Editor** e rode o conteúdo de
[`docs/sql/agendar-sincronizacao.sql`](sql/agendar-sincronizacao.sql),
trocando o segredo antes de executar.

✅ **Como conferir:** o job aparece na lista com o próximo horário de execução.

---

## Etapa 7 — Pegar os links de calendário e cadastrar

### 7.1 No Airbnb (repita para cada anúncio)

1. Acesse <https://www.airbnb.com.br/hosting/calendar>
2. Selecione o anúncio.
3. No painel da direita, abra **Disponibilidade**.
4. Role até **Sincronizar calendários** e clique em **Conectar a outro site**
   ou **Exportar calendário**.
5. Copie o link — ele termina em `.ics`, algo como
   `https://www.airbnb.com.br/calendar/ical/12345678.ics?s=abc...`

### 7.2 No Booking.com (repita para cada acomodação)

1. Acesse <https://admin.booking.com>
2. Menu **Tarifas e Disponibilidade** → **Sincronizar calendários**.
3. Clique em **Exportar calendário** e copie o link `.ics`.

> ⚠️ Esses links são secretos: quem tiver a URL enxerga sua ocupação. Trate
> como senha.

**Você só precisa da parte de *exportar*.** As telas das duas plataformas também
oferecem *importar* um calendário de fora ("Adicione um link de outro site",
"Nome do calendário"). Isso não tem relação com o dashboard — pode deixar em
branco e fechar a janela depois de copiar o link.

Se você já usa esse recurso para cruzar Airbnb e Booking entre si (o que ajuda a
evitar overbooking), pode continuar usando: a sincronização reconhece a mesma
estadia vinda dos dois feeds e registra só uma vez.

### 7.3 Cadastrar no seu dashboard

1. Abra seu site → **Configurações** → **Sincronização de Reservas**.
2. Clique em **Conectar** e preencha:
   - **Propriedade:** o imóvel correspondente
   - **Plataforma:** Airbnb ou Booking.com
   - **Link iCal:** o link copiado
   - **Nome do anúncio na plataforma:** o título exato do anúncio, como
     aparece no Airbnb/Booking. **Não pule esse campo** se você tem mais de um
     imóvel — é ele que faz os e-mails caírem na propriedade certa.
3. Salve e repita para cada anúncio. **Uma propriedade anunciada nas duas
   plataformas precisa de dois cadastros** — um com o link do Airbnb e outro com
   o do Booking.com, ambos apontando para a mesma propriedade.
4. Clique em **Sincronizar agora**.

✅ **Como conferir:** cada calendário fica com a etiqueta verde *Sincronizado* e
as reservas futuras aparecem na sua agenda (ainda sem nome e sem valor — isso
vem na próxima etapa).

---

## Etapa 8 — Ligar a leitura dos e-mails (nome do hóspede e valor)

Esta é a etapa que traz hóspede, valor, comissão e cancelamento.

1. Abra <https://script.google.com> com a conta de e-mail que **recebe** as
   mensagens do Airbnb e do Booking.
2. Clique em **Novo projeto**.
3. Apague o conteúdo do arquivo `Código.gs`.
4. Abra o script no GitHub e copie tudo com **Copy raw file**:
   <https://github.com/riohdigital/rio-host-dashboard-hub/blob/main/docs/scripts/gmail-forwarder.gs>
5. Cole no `Código.gs`.
6. Na linha `const SYNC_SECRET = 'COLE_AQUI_O_SEGREDO';`, troque
   `COLE_AQUI_O_SEGREDO` pelo valor da Etapa 2 (mantenha as aspas).
7. Clique no ícone de disquete (**Salvar**).
8. No seletor de função no topo, escolha **configurar** e clique em **Executar**.
   O Google vai pedir autorização: **Revisar permissões** → escolha sua conta →
   **Avançado** → **Acessar (não seguro)** → **Permitir**.
   *(Esse aviso aparece porque o script é seu e não foi publicado na loja do
   Google — é esperado.)*
9. Escolha a função **testarSemGravar** e clique em **Executar**. Abra
   **Registro de execução** (embaixo) e confira se ele mostrou os dados lidos de
   um e-mail. Nada é gravado nessa função.
10. Agora crie o agendamento: no menu da esquerda clique no **relógio**
    (*Acionadores*) → **Adicionar acionador**:
    - Função: `sincronizarReservas`
    - Origem do evento: **Baseado no tempo**
    - Tipo: **Timer de minutos** → **A cada 10 minutos**
    - Salvar.

✅ **Como conferir:** em até 10 minutos, as reservas do seu dashboard passam a
mostrar nome do hóspede e valor. No Gmail, os e-mails processados ganham o
rótulo `RioHost/Processado`.

---

## Etapa 9 — Conferência final

No seu site, em **Configurações → Sincronização de Reservas**, confira:

- **Calendários conectados:** todos com etiqueta verde e data de última leitura recente.
- **Últimas execuções:** deve haver linhas de "Calendário" e de "E-mail".
- **Precisam da sua conferência:** o que a automação não teve certeza aparece
  aqui. É normal ter itens — principalmente do Booking.com, porque o calendário
  dele não separa reserva de bloqueio manual.

---

## Se algo der errado

| O que você vê | O que fazer |
|---|---|
| A aba "Sincronização de Reservas" não aparece no site | A Etapa 1 não foi concluída, ou o Lovable ainda não sincronizou. Espere 5 min e recarregue com `Ctrl+Shift+R`. |
| Erro ao salvar o calendário | Confira se a Etapa 3 (tabelas) foi feita e se o link começa com `https://` e termina em `.ics`. |
| `HTTP 404 ao baixar o feed` | O link foi revogado. Exporte de novo no Airbnb/Booking. |
| "Sincronizar agora" dá erro 401 | A função não foi publicada (Etapa 5) ou o secret não foi salvo (Etapa 4). |
| Reservas aparecem sem nome e sem valor | O canal de e-mail (Etapa 8) não está rodando. Confira o Registro de execução no Apps Script. |
| Tudo cai em "Propriedade não identificada" | Falta preencher **Nome do anúncio na plataforma** no cadastro de cada calendário (Etapa 7.3). |
| `relation "cron.job" does not exist` ao criar o job | A extensão `pg_cron` não está ligada. Volte à Etapa 6.1. |
| Tipos *HTTP Request* / *Edge Function* aparecem cinzas | A extensão `pg_net` não está ligada. Volte à Etapa 6.1. |
| O agendamento não roda | Confira o job em <https://supabase.com/dashboard/project/cwcauobnbmzjpqjmmomc/integrations/cron/jobs> |

Os logs completos das funções ficam em
<https://supabase.com/dashboard/project/cwcauobnbmzjpqjmmomc/functions> →
clique na função → aba **Logs**.

Para entender **por que** a solução funciona desse jeito (e por que as APIs
oficiais não servem), veja [SINCRONIZACAO-AUTOMATICA.md](SINCRONIZACAO-AUTOMATICA.md).
