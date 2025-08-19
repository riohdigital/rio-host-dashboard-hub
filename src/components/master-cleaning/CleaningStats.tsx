import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, Clock, Users } from 'lucide-react';
import type { ReservationWithCleanerInfo, CleaningStats } from '@/types/master-cleaning';

interface CleaningStatsProps {
  allCleanings: ReservationWithCleanerInfo[];
  availableCleanings: ReservationWithCleanerInfo[];
}

const CleaningStats = ({ allCleanings, availableCleanings }: CleaningStatsProps) => {
  const pendingCleanings = allCleanings.filter(r => r.cleaning_status === 'Pendente');
  const completedCleanings = allCleanings.filter(r => r.cleaning_status === 'Realizada');
  
  // Estatísticas por faxineira
  const cleanerStats = allCleanings
    .filter(r => r.cleaner_info)
    .reduce((acc, reservation) => {
      const cleanerId = reservation.cleaner_user_id!;
      const cleanerName = reservation.cleaner_info!.full_name;
      
      if (!acc[cleanerId]) {
        acc[cleanerId] = {
          name: cleanerName,
          total: 0,
          pending: 0,
          completed: 0
        };
      }
      
      acc[cleanerId].total++;
      if (reservation.cleaning_status === 'Pendente') {
        acc[cleanerId].pending++;
      } else if (reservation.cleaning_status === 'Realizada') {
        acc[cleanerId].completed++;
      }
      
      return acc;
    }, {} as Record<string, { name: string; total: number; pending: number; completed: number }>);

  const stats = [
    {
      title: 'Total de Faxinas',
      value: allCleanings.length,
      icon: Calendar,
      color: 'text-primary'
    },
    {
      title: 'Pendentes',
      value: pendingCleanings.length,
      icon: Clock,
      color: 'text-orange-600'
    },
    {
      title: 'Concluídas',
      value: completedCleanings.length,
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      title: 'Disponíveis',
      value: availableCleanings.length,
      icon: Users,
      color: 'text-blue-600'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Cards de estatísticas gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Estatísticas por faxineira */}
      {Object.keys(cleanerStats).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Estatísticas por Faxineira
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(cleanerStats).map(([cleanerId, stats]) => (
                <div key={cleanerId} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium text-foreground">{stats.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Total: {stats.total}</Badge>
                    <Badge variant="secondary">Pendentes: {stats.pending}</Badge>
                    <Badge variant="default">Concluídas: {stats.completed}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CleaningStats;