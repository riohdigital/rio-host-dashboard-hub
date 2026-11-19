# Comprovante do Hóspede

Relatórios → Gerador de Recibos → Tipo **Comprovante do Hóspede**. Mostra quanto
o hóspede pagou em cada mês. Não mostra limpeza, comissão nem repasse.

## Valor pago pelo hóspede

`reservations.guest_total_paid` (lado do hóspede). Não confundir com
`total_revenue` (lado do anfitrião, depois da taxa da plataforma).

Ordem das fontes (`src/lib/guestReceipts.ts`):

1. `guest_total_paid` gravado — sincronização por e-mail ou formulário da reserva.
2. Reserva **Direta** sem valor gravado: `total_revenue`.
3. Conferência da plataforma (`platform_verified_data`), só se as datas conferidas
   forem as da linha: Booking `comissionavel`; Airbnb `payout_breakdown.guest_total_paid`.
4. Sem fonte: a reserva não gera comprovante (contador "sem valor pago pelo hóspede").

Sincronização (`_shared/emailParsers.ts`):

- Booking: "Preço total" do e-mail (só quando a R1 fecha).
- Airbnb: "TOTAL" do bloco "O HÓSPEDE PAGOU".
- Estadia parcelada (> 28 noites, R3): não grava, porque cada linha é um ciclo.
  Preencher à mão no formulário, se precisar.
- Reserva já existente: só completa a lacuna (não sobrescreve).

## Divisão por mês

Um comprovante por mês com noites da estadia, valor proporcional às noites
(centavos no último mês). Com filtro global de período, só os meses com noites
dentro do filtro. Reservas canceladas ficam de fora.

## Emissor

Configurações → **Emissão de Comprovantes** (`receipt_issuer_settings`, um
registro por usuário, RLS do próprio usuário). Sem registro: "Rioh Host".

## Pendências

- Reservas antigas de Airbnb/Booking sem conferência não têm o valor do hóspede.
  Preencher pelo formulário ou fazer um backfill a partir dos e-mails.
- Mapa de funcionalidades (`n8n-manager/projects/rioh-host/MAPA_DE_FUNCIONALIDADES_DASHBOARD.md`)
  precisa receber este módulo (o repositório não estava acessível nesta sessão).
