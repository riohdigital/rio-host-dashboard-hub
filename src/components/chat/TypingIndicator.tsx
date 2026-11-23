import MarcaIA from '@/components/comum/MarcaIA';

/** Resposta em andamento: bloco da IA com cursor piscando */
export const TypingIndicator = () => (
  <div className="mb-5 animate-fade-in" role="status" aria-label="A IA está respondendo">
    <MarcaIA className="mb-1.5" />
    <div className="flex items-center gap-1 text-sm text-gray-500">
      Pensando
      <span className="cursor-ia" aria-hidden="true" />
    </div>
  </div>
);
