

## Plano: Submenu Painel Gestor + Dashboard de Pagamentos

### Resumo

Transformar o menu "Painel Gestor" em um item colapsável com dois submenus (Dashboard e Pagamentos), e criar uma nova página completa de gestão de pagamentos mensais que automatiza o balanço financeiro que hoje e feito manualmente em planilhas.

### 1. Sidebar com Submenu Colapsável

Modificar `src/components/layout/Sidebar.tsx`:
- Remover "Painel Gestor" do array `menuItems`
- Adicionar um bloco separado com estado `gestorOpen` (toggle) que renderiza um item clicável com chevron
- Submenus: "Dashboard" (`/painel-gestor`) e "Pagamentos" (`/painel-gestor/pagamentos`)
- Auto-expandir quando a rota atual começa com `/painel-gestor`
- Importar `useLocation` de react-router-dom e ícones `ChevronDown`, `ChevronRight`, `CreditCard`

### 2. Nova Rota

Atualizar `src/App.tsx`:
- Adicionar rota `/painel-gestor/pagamentos` apontando para `PagamentosPage`

### 3. Hook de Dados: `usePaymentsDashboard`

Criar `src/hooks/painel-gestor/usePaymentsDashboard.ts`:
- Recebe `month` e `year` como parametros (seletor proprio na pagina, nao depende do filtro global de periodo)
- Respeita `selectedProperties` do GlobalFilters
- Busca reservations com checkout no mes selecionado (para faxineiras e proprietarios)
- Busca reservations com payment_date no mes (para agenda de recebimentos)
- Busca properties, cleaner_profiles e user_profiles para enrichment
- Retorna 3 estruturas principais:

**a) Faxineiras** (agrupado por cleaner):
```
{ cleanerId, cleanerName, phone, pix,
  cleanings: [{ date, propertyName, fee, paymentStatus, platform }],
  totalPaid, totalPending, total }
```

**b) Proprietarios** (agrupado por property):
```
{ propertyId, propertyName, nickname,
  platformBreakdown: [{ platform, totalRevenue, commission, netRevenue, status }],
  investments: number, // from property_investments no mes
  totalOwner, totalCommission }
```

**c) Agenda de Recebimentos** (cronologico):
```
{ date, entries: [{ propertyName, platform, amount, type, status }],
  dailyTotal }
```

**d) KPIs:**
- Total Comissoes Recebidas / Pendentes
- Total Faxinas Pagas / Pendentes  
- Total a Repassar para Proprietarios
- Saldo do Mes (recebido - pago - a repassar)

### 4. Pagina Principal: `PagamentosPage`

Criar `src/pages/PagamentosPage.tsx`:
- Header com seletor de mes/ano (navegacao por setas < Fevereiro 2026 >)
- Respects permissoes (master/gestor/owner)
- 4 KPI cards no topo com cores distintas
- 3 Tabs principais:

**Tab "Faxineiras":**
- Cards por faxineira com foto/nome/PIX
- Tabela interna: data | propriedade | valor | status (badge colorido)
- Footer com totais Pago/Pendente
- Badge de status por limpeza: Pago (verde), Pendente (amarelo), Proximo Ciclo (azul)

**Tab "Proprietarios":**
- Cards por propriedade com breakdown por plataforma
- Mostra: Receita Bruta, Comissao, Investimentos do Mes, Valor Liquido Proprietario
- Deduz automaticamente investimentos (`property_investments`) do mes
- Formula: `net_revenue - investimentos_mes = valor_a_repassar`

**Tab "Agenda":**
- Timeline cronologica de recebimentos por data
- Cada entrada mostra: propriedade, plataforma (badge colorido), valor, status
- Subtotais diarios e total geral acumulado
- Cores: Airbnb (rosa), Booking (azul), Direto (verde)

### 5. Componentes

Criar em `src/components/pagamentos/`:
- `PaymentsKPICards.tsx` - 4 cards de resumo
- `CleanerPaymentsTab.tsx` - Tab de faxineiras com cards expansiveis
- `OwnerPaymentsTab.tsx` - Tab de proprietarios com breakdown
- `RevenueScheduleTab.tsx` - Tab de agenda cronologica
- `MonthYearSelector.tsx` - Navegador de mes/ano com setas

### 6. Logica de Negocio

Regras de pagamento por plataforma (ja existentes no sistema):
- **Airbnb**: Recebimento D+1 do check-in. Status "recebido" se check_in <= hoje
- **Booking.com**: Recebimento no 1o dia do mes seguinte ao checkout. Status "pendente" se checkout no mes atual
- **Direto**: Recebimento no check-in. Status "recebido" se check_in <= hoje

Regras de faxina:
- `cleaning_payment_status` da reserva define o status (Pago, Pendente, Proximo Ciclo, Pagamento na Data)
- `cleaning_fee` da reserva define o valor
- Agrupado por `cleaner_user_id` com join em `user_profiles` para nome

### Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| `src/components/layout/Sidebar.tsx` | Modificar - submenu colapsavel |
| `src/App.tsx` | Modificar - nova rota |
| `src/pages/PagamentosPage.tsx` | Criar |
| `src/hooks/painel-gestor/usePaymentsDashboard.ts` | Criar |
| `src/components/pagamentos/PaymentsKPICards.tsx` | Criar |
| `src/components/pagamentos/CleanerPaymentsTab.tsx` | Criar |
| `src/components/pagamentos/OwnerPaymentsTab.tsx` | Criar |
| `src/components/pagamentos/RevenueScheduleTab.tsx` | Criar |
| `src/components/pagamentos/MonthYearSelector.tsx` | Criar |

Nenhuma alteracao de banco de dados necessaria - todos os dados ja existem nas tabelas `reservations`, `properties`, `property_investments`, `user_profiles` e `cleaner_profiles`.

