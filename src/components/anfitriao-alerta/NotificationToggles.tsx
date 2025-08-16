import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationDestination, useNotificationDestinations } from '@/hooks/useNotificationDestinations';

interface NotificationTogglesProps {
  destination: NotificationDestination;
}

interface NotificationPreferences {
  checkin_reminders: boolean;
  checkout_reminders: boolean;
  cleaning_alerts: boolean;
  payment_notifications: boolean;
  guest_communications: boolean;
  maintenance_alerts: boolean;
}

const defaultPreferences: NotificationPreferences = {
  checkin_reminders: true,
  checkout_reminders: true,
  cleaning_alerts: true,
  payment_notifications: false,
  guest_communications: false,
  maintenance_alerts: false,
};

const NotificationToggles = ({ destination }: NotificationTogglesProps) => {
  const { updateDestination } = useNotificationDestinations();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);

  useEffect(() => {
    if (destination.preferences) {
      setPreferences({ ...defaultPreferences, ...destination.preferences });
    }
  }, [destination]);

  const handleToggle = async (key: keyof NotificationPreferences) => {
    const newPreferences = {
      ...preferences,
      [key]: !preferences[key]
    };
    
    setPreferences(newPreferences);
    await updateDestination(destination.id, {
      preferences: newPreferences
    });
  };

  const notificationTypes = [
    {
      key: 'checkin_reminders' as keyof NotificationPreferences,
      title: 'Lembretes de Check-in',
      description: 'Notificações antes do horário de check-in dos hóspedes'
    },
    {
      key: 'checkout_reminders' as keyof NotificationPreferences,
      title: 'Lembretes de Check-out',
      description: 'Notificações sobre check-outs e preparação para limpeza'
    },
    {
      key: 'cleaning_alerts' as keyof NotificationPreferences,
      title: 'Alertas de Limpeza',
      description: 'Notificações sobre agendamento e status de limpeza'
    },
    {
      key: 'payment_notifications' as keyof NotificationPreferences,
      title: 'Notificações de Pagamento',
      description: 'Alertas sobre pagamentos recebidos e pendências'
    },
    {
      key: 'guest_communications' as keyof NotificationPreferences,
      title: 'Comunicações com Hóspedes',
      description: 'Notificações sobre mensagens e solicitações de hóspedes'
    },
    {
      key: 'maintenance_alerts' as keyof NotificationPreferences,
      title: 'Alertas de Manutenção',
      description: 'Notificações sobre necessidades de manutenção'
    }
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Preferências de Notificação</h3>
        <p className="text-sm text-muted-foreground">
          Configure quais tipos de alertas este destinatário deve receber
        </p>
      </div>

      <div className="space-y-3">
        {notificationTypes.map((type) => (
          <Card key={type.key}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{type.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
                <Switch
                  checked={preferences[type.key]}
                  onCheckedChange={() => handleToggle(type.key)}
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