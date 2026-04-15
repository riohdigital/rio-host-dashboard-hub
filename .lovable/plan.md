## Plano: Duplicar reserva existente ao criar nova

### O que muda

Ao clicar em "Adicionar Nova Reserva", o formulário terá uma seção opcional no topo para buscar e copiar dados de uma reserva existente. O usuário digita o código da reserva (ou nome do hóspede), seleciona a reserva desejada, e os campos são preenchidos automaticamente — exceto `id` e `created_at`, que ficam em branco para o usuário preencher.

### Como funciona

1. No topo do `ReservationForm`, quando `reservation` é `null` (modo criação), aparece um campo de busca "Duplicar uma Reserva"
2. O usuário digita pelo menos 3 caracteres (código da reserva ou nome do hóspede)
3. Uma busca é feita no Supabase filtrando por `reservation_code` ou `guest_name` (ilike)
4. Os resultados aparecem em um dropdown com: código, hóspede, propriedade e datas
5. Ao selecionar, os campos do formulário são preenchidos via `setValue()` com os dados da reserva selecionada
6. Campos que NÃO são copiados: `id`, `created_at`, `payment_date`
7. Campos que SÃO copiados: `reservation_code, check_in_date`, `check_out_date, property_id`, `platform`, `guest_name`, `guest_email`, `guest_phone`, `number_of_guests`, `total_revenue`, `checkin_time`, `checkout_time`, `cleaning_fee`, `cleaning_allocation`, `cleaner_user_id`, `payment_status`, `reservation_status`

### UI

```text
┌─────────────────────────────────────────┐
│ Nova Reserva                            │
│                                         │
│ 📋 Copiar de reserva existente          │
│ [🔍 Buscar por código ou hóspede...   ] │
│ ┌─────────────────────────────────────┐ │
│ │ HMWE2EHT4F - João Silva             │ │
│ │ Copa Ester · 10/04 - 15/04         │ │
│ │ ─────────────────────────────────── │ │
│ │ ABC123 - Maria Santos               │ │
│ │ Rio Marina · 05/04 - 08/04         │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ── Dados da Reserva ──                  │
│ [formulário normal preenchido]          │
└─────────────────────────────────────────┘
```

### Arquivo modificado


| Arquivo                                           | Mudança                                                                                                                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/reservations/ReservationForm.tsx` | Adicionar seção de busca/duplicação no topo do formulário (modo criação apenas), com busca no Supabase e preenchimento automático via `setValue()` |


Nenhuma mudança no banco, hooks ou outras páginas.