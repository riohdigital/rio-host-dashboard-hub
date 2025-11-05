import { MessageSquare, DollarSign, Calendar, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeMessageProps {
  onQuickReply: (message: string) => void;
}

export const WelcomeMessage = ({ onQuickReply }: WelcomeMessageProps) => {
  const quickReplies = [
    {
      icon: DollarSign,
      text: 'Qual foi o caixa deste mês?',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      icon: Calendar,
      text: 'Mostrar próximas reservas',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Sparkles,
      text: 'Status de limpeza hoje',
      gradient: 'from-purple-500 to-pink-500',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center mb-4 shadow-lg">
        <MessageSquare className="w-8 h-8 text-white" />
      </div>
      <h3 className="font-semibold text-lg mb-2">Olá! Como posso ajudar?</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Envie uma mensagem ou escolha uma das opções abaixo
      </p>

      <div className="w-full space-y-2">
        {quickReplies.map((reply, index) => {
          const Icon = reply.icon;
          return (
            <Button
              key={index}
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3 hover:border-purple-500 transition-all"
              onClick={() => onQuickReply(reply.text)}
            >
              <div className={`p-2 rounded-lg bg-gradient-to-br ${reply.gradient}`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm">{reply.text}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
