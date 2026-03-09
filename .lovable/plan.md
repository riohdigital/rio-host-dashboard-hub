
## Diagnóstico completo

Após analisar o banco de dados real da propriedade "Copacabana - Ester" (`id: b2d53163...`):

**Problema 1 — Faxineiras:** Em março/2026 não há reservas com `check_out_date` nesse mês. A lógica atual só mostra faxineiras que aparecem nas reservas do período. O usuário quer ver **todas as faxineiras vinculadas à propriedade** via `cleaner_properties`, mesmo sem faxinas no mês (totais zerados).

**Problema 2 — Proprietários:** A tab de proprietários é baseada em `reservation.property_id`, o que é correto — cada propriedade aparece como um "card de proprietário". Mas se não há reservas com checkout no mês, o card não aparece. Além disso, o usuário confirmou que o vínculo é por usuários do sistema, não pelo Anfitrião Alerta.

**Problema 3 — Filtro de data para faxineiras vs proprietários:** As faxineiras devem aparecer por checkout no mês (faxina acontece no checkout). Os proprietários devem aparecer por `payment_date` no mês (seguindo regras: Airbnb D+1 check-in, Booking 1º dia mês seguinte, Direto no check-in).

**Problema 4 — Período vazio:** Para março/2026 a Copacabana Ester não tem checkout, mas tem `payment_date` em março para reservas Booking de fevereiro. O hook precisa buscar reservas tanto por checkout (faxineiras) quanto por payment_date (proprietários/agenda).

---

## Plano de correção

### 1. Hook `usePaymentsDashboard.ts` — 3 consultas separadas

**Query A — Para Faxineiras:** `check_out_date` dentro do mês (faxina acontece no checkout)

**Query B — Para Proprietários/Agenda:** `payment_date` dentro do mês (quando o dinheiro entra). Esta é a lógica de caixa.

**Query C — Para Faxineiras vinculadas sem faxina:** `cleaner_properties` filtrado pelas propriedades selecionadas — buscar todos os vínculos de faxineiras, criar cards com totais zerados para quem não teve faxina no mês mas está vinculada.

**Nova lógica de faxineiras:**
```
1. Buscar faxinas do mês por check_out_date (Query A)
2. Buscar todas as faxineiras vinculadas às propriedades selecionadas via fn_get_cleaners_for_properties
3. Para cada faxineira vinculada: criar card (com dados das faxinas se houver, ou totais zero)
4. Resultado: todas as vinculadas aparecem, mesmo sem faxinas no mês
```

**Nova lógica de proprietários:**
```
1. Reservas são agrupadas por property_id (como está)
2. A query passa a usar payment_date no mês em vez de check_out_date
3. Cada propriedade selecionada aparece como card, mesmo sem reservas no mês (via propriedades)
4. Quando não houver reservas pagas no mês: card mostra totais zero
```

### 2. PagamentosPage.tsx — Nenhuma mudança estrutural

A página já está correta com seletor de propriedades e mês.

### 3. CleanerPaymentsTab.tsx — Mostrar faxineiras sem faxinas no mês

Adicionar badge visual "Sem faxinas neste mês" para faxineiras com `total === 0` em vez de ocultar o card.

### 4. OwnerPaymentsTab.tsx — Mostrar propriedades mesmo sem pagamentos no mês

Quando uma propriedade é selecionada mas não tem `payment_date` no mês, mostrar card com totais zero e mensagem "Nenhum recebimento no mês" em vez de esconder.

---

## Mudanças no hook (detalhe técnico)

```typescript
// Query A: faxinas (checkout no mês)
reservations WHERE check_out_date IN [startDate, endDate] AND NOT Cancelada

// Query B: recebimentos (payment_date no mês - para proprietários e agenda)  
reservations WHERE payment_date IN [startDate, endDate] AND NOT Cancelada

// Query C: faxineiras vinculadas (para mostrar mesmo sem faxinas)
fn_get_cleaners_for_properties(propertyIds)

// Lógica de faxineiras:
const cleanerMap = Map<cleanerId, CleanerPayment>
// 1. Inicializar todas as faxineiras vinculadas (Query C) com totais zero
linkedCleaners.forEach(c => cleanerMap.set(c.user_id, {totals: zero, cleanings: []}))
// 2. Enriquecer com faxinas do mês (Query A)
allReservations.forEach(res => { if cleaner_user_id: add to existing or create })

// Lógica de proprietários:
// Usar reservas de Query B (payment_date) para calcular recebimentos
// Mostrar card para cada propriedade selecionada (mesmo sem reservas)
```

---

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/painel-gestor/usePaymentsDashboard.ts` | Refatorar: 3 queries, faxineiras via cleaner_properties, proprietários via payment_date |
| `src/components/pagamentos/CleanerPaymentsTab.tsx` | Mostrar card com totais zero quando faxineira vinculada sem faxinas |
| `src/components/pagamentos/OwnerPaymentsTab.tsx` | Mostrar card quando propriedade selecionada sem pagamentos no mês |

Nenhuma alteração de banco de dados necessária.
