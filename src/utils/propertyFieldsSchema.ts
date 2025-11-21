export const getPropertyFieldsSchema = () => ({
  name: {
    type: "string",
    required: true,
    description: "Nome da propriedade conforme aparece no anúncio",
    example: "Apartamento aconchegante no Centro"
  },
  address: {
    type: "string",
    required: false,
    description: "Endereço completo da propriedade",
    example: "Rua da Praia, 123 - Copacabana"
  },
  property_type: {
    type: "string",
    required: true,
    description: "Tipo de acomodação",
    options: ["Apartamento", "Casa", "Studio", "Loft", "Chalé", "Flat", "Estúdio"],
    example: "Apartamento"
  },
  max_guests: {
    type: "number",
    required: false,
    description: "Capacidade máxima de hóspedes",
    example: 4
  },
  base_nightly_price: {
    type: "number",
    required: false,
    description: "Preço médio da diária (apenas número, sem R$ ou símbolos)",
    example: 250.00
  },
  notes: {
    type: "string",
    required: false,
    description: "Descrição completa: amenidades, características especiais, regras da casa",
    example: "Apartamento com 2 quartos, ar-condicionado, wifi..."
  },
  default_checkin_time: {
    type: "string",
    required: false,
    format: "HH:MM",
    description: "Horário padrão de entrada (formato 24h)",
    example: "15:00"
  },
  default_checkout_time: {
    type: "string",
    required: false,
    format: "HH:MM",
    description: "Horário padrão de saída (formato 24h)",
    example: "11:00"
  }
});

export const getExpectedResponseFormat = () => ({
  name: "string",
  address: "string | undefined",
  property_type: "string",
  max_guests: "number | undefined",
  base_nightly_price: "number | undefined",
  notes: "string | undefined",
  default_checkin_time: "string (HH:MM) | undefined",
  default_checkout_time: "string (HH:MM) | undefined"
});
