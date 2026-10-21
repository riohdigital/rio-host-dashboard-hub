import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationDestination, useNotificationDestinations } from '@/hooks/useNotificationDestinations';

interface NotificationTogglesProps {
  destination: NotificationDestination;
}

interface ToggleConfig {
  key: string;
  title: string;
  description: string;
}

// Alertas de mudança de reserva: o workflow "Anfitrião Alerta Avisos" já os envia (padrão ligado).
const MUDANCAS_DE_RESERVA: ToggleConfig[] = [
  {
    key: 'cancellation_alert',
    title: 'Reserva Cancelada',
    description: 'Aviso quando uma reserva é cancelada na plataforma'
  },
  {
    key: 'modification_alert',
    title: 'Reserva Modificada',
    description: 'Aviso quando datas, hóspedes ou valor de uma reserva mudam'
  }
];

// Radar de precificação (Precificação → Oportunidades): ligado por padrão.
const OPORTUNIDADES_DE_PRECO: ToggleConfig = {
  key: 'pricing_alert',
  title: 'Oportunidades de Preço',
  description: 'Feriados e eventos encontrados com o imóvel livre, para antecipar a precificação (as oportunidades continuam na página Precificação)'
};

// Sentinela da precificação: avisa quando a automação falha de novo e de novo ou para (ligado por padrão).
const SAUDE_DA_PRECIFICACAO: ToggleConfig = {
  key: 'pricing_health_alert',
  title: 'Saúde da Precificação',
  description: 'Aviso quando a precificação automática de um imóvel falha repetidamente ou para de se atualizar'
};

// Toggles específicos por role
const getTogglesByRole = (role: string): ToggleConfig[] => {
  switch (role) {
    case 'faxineira':
      return [
        {
          key: 'cleaner_assignment',
          title: 'Aviso de Nova Atribuição',
          description: 'Notificação imediata quando for atribuída a uma reserva'
        },
        {
          key: 'cleaner_48h',
          title: 'Lembrete 48h Antes',
          description: 'Aviso 2 dias antes às 12h com detalhes da faxina'
        },
        {
          key: 'cleaner_24h',
          title: 'Lembrete 24h Antes',
          description: 'Confirmação na véspera às 19h'
        },
        {
          key: 'cleaner_day_of_alerts',
          title: 'Aviso Dia da Faxina',
          description: 'Mensagem motivacional às 7h no dia'
        },
        // Só das reservas em que a faxineira está atribuída.
        ...MUDANCAS_DE_RESERVA
      ];
    
    case 'proprietario':
      return [
        {
          key: 'checkin_reminders',
          title: 'Lembretes de Check-in',
          description: 'Notificações 24h antes do check-in dos hóspedes'
        },
        {
          key: 'payment_notifications',
          title: 'Notificações de Pagamento',
          description: 'Alertas sobre pagamentos recebidos'
        },
        {
          key: 'new_booking_alert',
          title: 'Nova Reserva',
          description: 'Notificação imediata de novas reservas confirmadas'
        },
        ...MUDANCAS_DE_RESERVA,
        OPORTUNIDADES_DE_PRECO,
        SAUDE_DA_PRECIFICACAO
      ];
    
    case 'co-anfitriao':
    case 'gestor':
      return [
        {
          key: 'checkin_reminders',
          title: 'Lembretes de Check-in (24h)',
          description: 'Notificações um dia antes do check-in'
        },
        {
          key: 'checkin_today',
          title: 'Check-in Hoje',
          description: 'Aviso às 8h sobre check-ins do dia'
        },
        {
          key: 'checkout_review',
          title: 'Checkout + Avaliação',
          description: 'Aviso no dia seguinte ao checkout para pedir avaliação'
        },
        {
          key: 'new_booking_alert',
          title: 'Nova Reserva',
          description: 'Notificação imediata de novas reservas confirmadas'
        },
        {
          key: 'cleaning_risk',
          title: 'Alerta Risco Limpeza',
          description: 'Aviso 3 dias antes se não houver faxineira atribuída'
        },
        ...MUDANCAS_DE_RESERVA,
        OPORTUNIDADES_DE_PRECO,
        SAUDE_DA_PRECIFICACAO
      ];
    
    default: // 'outro' ou qualquer outro
      return [
        {
          key: 'checkin_reminders',
          title: 'Lembretes de Check-in',
          description: 'Notificações antes do horário de check-in dos hóspedes'
        },
        {
          key: 'checkout_reminders',
          title: 'Lembretes de Check-out',
          description: 'Notificações sobre check-outs e preparação para limpeza'
        },
        {
          key: 'cleaning_alerts',
          title: 'Alertas de Limpeza',
          description: 'Notificações sobre agendamento e status de limpeza'
        }
      ];
  }
};

// Defaults por role
const getDefaultPreferences = (role: string): Record<string, boolean> => {
  const toggles = getTogglesByRole(role);
  return toggles.reduce((acc, toggle) => {
    acc[toggle.key] = true;
    return acc;
  }, {} as Record<string, boolean>);
};

const NotificationToggles = ({ destination }: NotificationTogglesProps) => {
  const { updateDestination } = useNotificationDestinations();
  const [preferences, setPreferences] = useState<Record<string, boolean>>({});

  const toggles = getTogglesByRole(destination.destination_role);

  useEffect(() => {
    const defaults = getDefaultPreferences(destination.destination_role);
    if (destination.preferences) {
      setPreferences({ ...defaults, ...destination.preferences });
    } else {
      setPreferences(defaults);
    }
  }, [destination]);

  const handleToggle = async (key: string) => {
    const newPreferences = {
      ...preferences,
      [key]: !preferences[key]
    };
    
    setPreferences(newPreferences);
    await updateDestination(destination.id, {
      preferences: newPreferences
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Preferências de Notificação</h3>
        <p className="text-sm text-muted-foreground">
          Configure quais alertas este destinatário ({destination.destination_role}) deve receber
        </p>
      </div>

      <div className="space-y-3">
        {toggles.map((toggle) => (
          <Card key={toggle.key}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{toggle.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{toggle.description}</p>
                </div>
                <Switch
                  checked={preferences[toggle.key] || false}
                  onCheckedChange={() => handleToggle(toggle.key)}
                />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default NotificationToggles;
