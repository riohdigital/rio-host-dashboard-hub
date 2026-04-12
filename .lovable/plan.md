

## Plano: Adicionar seletor de Mês/Ano ao filtro "Período Personalizado"

### O que muda

Quando o usuário seleciona "Período Personalizado", além dos dois date pickers já existentes, aparecerá uma nova seção "Selecionar Mês" com dois selects (mês e ano). Ao escolher mês+ano, o sistema define automaticamente `customStartDate` como dia 1 e `customEndDate` como último dia do mês, usando o mesmo mecanismo `custom` que já existe — sem criar novo período nem alterar nenhuma regra de filtragem.

### Como funciona

- O período selecionado continua sendo `custom` (reusa toda a lógica existente no `useDateRange`)
- O seletor de mês/ano é apenas um atalho que preenche as datas de início e fim automaticamente
- Os date pickers continuam visíveis e editáveis — o usuário pode ajustar depois se quiser
- Nenhuma alteração em `GlobalFiltersContext`, `useDateRange`, nem em nenhuma outra página

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/layout/GlobalFilters.tsx` | Adicionar seletor de mês (Select com Jan-Dez) e ano (Select com range de anos) dentro do bloco `selectedPeriod === 'custom'`, acima dos date pickers existentes. Ao selecionar mês+ano, chama `setCustomStartDate(new Date(year, month, 1))` e `setCustomEndDate(new Date(year, month+1, 0))` |

### UI

Dentro do bloco `custom` existente (linhas 174-198), antes dos date pickers:

```text
┌─────────────────────────────┐
│ Selecionar Mês              │
│ [Mês ▼]  [Ano ▼]           │
│ ─── ou ───                  │
│ Data Inicial: [___________] │
│ Data Final:   [___________] │
│ X dias selecionados         │
└─────────────────────────────┘
```

- Select de mês: Janeiro a Dezembro
- Select de ano: de 2020 até ano atual + 1
- Ao selecionar ambos, preenche as datas automaticamente

