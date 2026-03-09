

## Bug: Status de pagamento de faxina incorreto

### Causa raiz

Na função `getCleaningPaymentStatus`, a verificação de status "Pago" usa `status.includes(s)`:

```typescript
const PAID_STATUSES = ['Pago', 'Paga', 'pago', 'paga', 'PAGO'];
if (PAID_STATUSES.some(s => status.includes(s))) return 'Pago';
```

O problema é que `"Pagamento no Próximo Ciclo".includes("Pago")` retorna `true`, fazendo com que qualquer status contendo a palavra "Pago" (como "Pagamento no Próximo Ciclo", "Pagamento na Data") seja classificado como "Pago".

A checagem de "Próximo Ciclo" na linha seguinte nunca é alcançada porque a condição de "Pago" já retornou antes.

### Correção

Reordenar as verificações para checar os status compostos **antes** do status simples "Pago", e usar comparação exata (`===`) em vez de `includes`:

```typescript
const getCleaningPaymentStatus = (status: string | null): string => {
  if (!status) return 'Pendente';
  const lower = status.toLowerCase().trim();
  // Checar status compostos PRIMEIRO
  if (lower.includes('próximo ciclo') || lower.includes('proximo ciclo')) return 'Próximo Ciclo';
  if (lower.includes('pagamento na data')) return 'Pagamento na Data';
  if (lower.includes('d+1')) return 'D+1';
  // Só depois checar se é exatamente "Pago"/"Paga"
  if (['pago', 'paga'].includes(lower)) return 'Pago';
  return status;
};
```

### Arquivo modificado

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/painel-gestor/usePaymentsDashboard.ts` | Corrigir ordem e lógica da função `getCleaningPaymentStatus` |

Nenhuma alteração de banco de dados necessária.

