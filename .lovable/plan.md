
## Understanding the Issues

After reviewing all files, I identified these problems:

1. **Bug in `usePaymentsDashboard.ts`**: The hook reads `selectedProperties` from global context but the actual reservation queries (`allReservations`, `scheduleReservations`) **never apply this filter** — only `propertiesQuery` does. Data always loads unfiltered.
2. **No guidance/empty state** on first load.
3. **No property selector** local to the Payments page (independent of the global sidebar filter).
4. **No cleaner or owner filters** inside the tabs.

---

## Plan

### 1. Fix `usePaymentsDashboard.ts`

- Remove `useGlobalFilters` dependency; instead accept `propertyIds: string[]` directly as a parameter.
- Apply the property filter to **all three queries**: `allReservations`, `scheduleReservations`, `propertiesQuery`.
- When `propertyIds` includes `'todas'` or is empty → no filter (fetch all).

### 2. Update `PagamentosPage.tsx`

Add above the Tabs:

**Filter bar row:**
- `PropertyMultiSelect` (reuse existing component from `src/components/dashboard/PropertyMultiSelect.tsx`) with properties from `useProperties` hook.
- `MonthYearSelector` (already there, move to this row).
- Refresh button.

**Guidance banner:**
- When `selectedProperties` is `['todas']` and no data loaded yet, show a subtle info callout: _"Selecione uma propriedade e um mês para visualizar faxineiras, proprietários e agenda de recebimentos."_
- Use a light blue `Alert` component styled to match the site design.

Pass property filter state to the hook (replace global context reliance).

### 3. Update `CleanerPaymentsTab.tsx`

Add a filter bar at the top of the tab with:
- A **search input** (`Input` with search icon) to filter by cleaner name.
- A **`Select` dropdown** showing all available cleaners (populated from the received data) for quick selection.
- Apply filter client-side against the received `cleanerPayments` array.
- Show empty state "Nenhuma faxineira corresponde ao filtro" when filtered list is empty.

### 4. Update `OwnerPaymentsTab.tsx`

Add a filter bar at the top with:
- A **search input** to filter by property name/nickname.
- Apply filter client-side against `ownerPayments`.
- Show empty state when filtered list is empty.

### 5. Improve empty states across all tabs

When data is empty **and** no specific property is selected, show a more actionable empty state:
> "Selecione uma ou mais propriedades no filtro acima para ver os dados deste mês."

---

## Files Modified

| File | Change |
|------|--------|
| `src/hooks/painel-gestor/usePaymentsDashboard.ts` | Accept `propertyIds` param, fix query filtering bug |
| `src/pages/PagamentosPage.tsx` | Property selector, guidance banner, pass filters |
| `src/components/pagamentos/CleanerPaymentsTab.tsx` | Cleaner search + select filter |
| `src/components/pagamentos/OwnerPaymentsTab.tsx` | Owner/property search filter |

No database changes needed.
