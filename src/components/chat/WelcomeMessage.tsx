import { DollarSign, Calendar, Sparkles } from 'lucide-react';
import MarcaIA from '@/components/comum/MarcaIA';

const SUGESTOES = [
  { icon: DollarSign, text: 'Qual foi o caixa deste mês?' },
  { icon: Calendar, text: 'Mostrar próximas reservas' },
  { icon: Sparkles, text: 'Status de limpeza hoje' },
];

/** Boas-vindas no meio da conversa vazia */
export const WelcomeMessage = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-10 text-center">
    <MarcaIA className="text-xs" />
    <h3 className="font-display text-xl font-bold text-ink">Olá! Como posso ajudar?</h3>
    <p className="max-w-xs text-sm text-gray-600">
      Pergunte sobre reservas, caixa, faxinas ou mande um print. Algumas ideias logo acima da caixa de texto.
    </p>
  </div>
);

/** Sugestões iniciais: chips roláveis acima da caixa de texto */
export const SugestoesIniciais = ({ onQuickReply }: { onQuickReply: (message: string) => void }) => (
  <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-4 pb-2">
    {SUGESTOES.map(({ icon: Icon, text }) => (
      <button
        key={text}
        type="button"
        onClick={() => onQuickReply(text)}
        className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {text}
      </button>
    ))}
  </div>
);
