

## Plano: Lógica "Repassado" vs "A Repassar" por plataforma

### Regra de negócio
- **Airbnb / Direto** + received → **"Repassado"** (verde)
- **Booking.com** + received → **"A Repassar"** (âmbar)
- Qualquer plataforma + pending → **"Pendente"** (cinza)

### Mudanças em `src/components/pagamentos/OwnerPaymentsTab.tsx`

**1. Badge de status por plataforma (linhas 129-137)**

Substituir lógica genérica "Recebido"/"A Receber" por:
- Helper function `getTransferLabel(platform, status)` que retorna { label, className }
- Airbnb/Direto received → "Repassado" (verde)
- Booking received → "A Repassar" (âmbar)  
- pending → "Pendente" (cinza)

**2. Cálculo do Repasse (linhas 162-185)**

Calcular dois totais a partir de `owner.platformBreakdown`:
- `totalRepassado` = soma netRevenue de Airbnb/Direto com status received
- `totalARepassar` = soma netRevenue de Booking com status received

Mostrar duas linhas separadas quando aplicável, antes da dedução de investimentos.

**3. Summary bar (linha 276)**

Calcular totais globais de "Repassado" e "A Repassar" separadamente a partir de todos os owners filtrados. Mostrar ambos quando existirem.

**4. Header do card (linha 102)**

Substituir "Repasse" genérico por mostrar "Repassado" e/ou "A Repassar" conforme a composição das plataformas daquele owner.

### Arquivo modificado
| Arquivo | Mudança |
|---------|---------|
| `src/components/pagamentos/OwnerPaymentsTab.tsx` | Badge por plataforma, cálculo separado, summary bar |

Nenhuma mudança no hook nem no banco.

