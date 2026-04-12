

## Problema

Quando o usuário edita manualmente os valores financeiros (cleaning_fee, commission_amount, net_revenue) de uma reserva, esses valores são perdidos ao reabrir o formulário de edição por dois motivos:

1. **Frontend**: O `useEffect` de cálculo financeiro (linha 201-251) recalcula tudo automaticamente ao abrir, sobrescrevendo os valores salvos no banco
2. **Submissão**: As linhas 288-290 deletam `base_revenue`, `commission_amount` e `net_revenue` do payload antes de enviar ao banco
3. **Trigger do banco**: O trigger `trigger_calculate_reservation_financials` recalcula esses campos em todo INSERT/UPDATE de `total_revenue, cleaning_fee, cleaning_allocation, property_id`

O resultado é que valores manuais nunca persistem.

## Solução

### 1. Banco de dados: Permitir override manual

Adicionar uma migration que:
- Modifica a função `calculate_reservation_financials()` para **respeitar valores manuais**: se `commission_amount` ou `net_revenue` já estiverem definidos no UPDATE e não forem resultado de mudança nos campos-gatilho (`total_revenue`, `cleaning_fee`, `cleaning_allocation`, `property_id`), manter os valores existentes
- Abordagem simplificada: comparar `OLD` vs `NEW` — se `total_revenue`, `cleaning_fee`, `cleaning_allocation` e `property_id` **não mudaram**, não recalcular (manter os valores que vieram no UPDATE)

```sql
-- Se nenhum campo financeiro-chave mudou, preservar valores manuais
IF TG_OP = 'UPDATE' 
   AND OLD.total_revenue = NEW.total_revenue 
   AND COALESCE(OLD.cleaning_fee, 0) = COALESCE(NEW.cleaning_fee, 0)
   AND OLD.cleaning_allocation IS NOT DISTINCT FROM NEW.cleaning_allocation
   AND OLD.property_id IS NOT DISTINCT FROM NEW.property_id
THEN
  RETURN NEW; -- Manter valores como estão (incluindo manuais)
END IF;
```

### 2. Frontend: Enviar valores financeiros no submit

No `ReservationForm.tsx`:
- **Remover** as linhas 288-290 que deletam `base_revenue`, `commission_amount` e `net_revenue`
- Incluir esses campos no `submissionData` para que valores manuais sejam enviados ao banco

### 3. Frontend: Detectar valores manuais ao abrir edição

No `ReservationForm.tsx`:
- Ao carregar a reserva para edição (useEffect linha 125-137), comparar os valores salvos (`reservation.commission_amount`, `reservation.cleaning_fee`) com o cálculo automático baseado na propriedade
- Se divergirem, inicializar `manualCommission` e `manualCleaningFee` com os valores da reserva para que o useEffect de cálculo use os valores manuais em vez de recalcular

Lógica no useEffect de inicialização (após `reset(initialValues)`):
```typescript
// Após reset, verificar se valores financeiros foram alterados manualmente
const property = properties.find(p => p.id === reservation.property_id);
if (property) {
  const expectedCleaningFee = property.cleaning_fee || 0;
  const expectedBase = reservation.total_revenue - expectedCleaningFee;
  const expectedCommission = expectedBase * (property.commission_rate || 0);
  
  // Se cleaning_fee difere do padrão, foi manual
  if (reservation.cleaning_fee != null && Math.abs(reservation.cleaning_fee - expectedCleaningFee) > 0.01) {
    setManualCleaningFee(reservation.cleaning_fee);
  }
  // Se comissão difere do cálculo automático, foi manual
  if (reservation.commission_amount != null && Math.abs(reservation.commission_amount - expectedCommission) > 0.01) {
    setManualCommission(reservation.commission_amount);
  }
}
```

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| Nova migration SQL | Trigger condicional: só recalcula se campos-gatilho mudaram |
| `src/components/reservations/ReservationForm.tsx` | Enviar valores financeiros no submit + detectar overrides manuais ao abrir edição |

