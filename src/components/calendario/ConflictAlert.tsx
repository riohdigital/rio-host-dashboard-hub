import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, X } from 'lucide-react';
import { Conflict } from '@/hooks/useConflictDetection';
import { format } from 'date-fns';

interface ConflictAlertProps {
  conflicts: Conflict[];
  onDismiss?: () => void;
}

const ConflictAlert = ({ conflicts, onDismiss }: ConflictAlertProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);

  if (conflicts.length === 0) return null;

  const overlapCount = conflicts.filter(c => c.conflictType === 'overlap').length;
  const gapCount = conflicts.filter(c => c.conflictType === 'gap_too_short').length;

  return (
    <>
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between">
          <span>
            {conflicts.length} Conflito{conflicts.length > 1 ? 's' : ''} Detectado{conflicts.length > 1 ? 's' : ''}
          </span>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <div className="flex gap-2">
            {overlapCount > 0 && (
              <Badge variant="destructive">
                {overlapCount} Sobreposição{overlapCount > 1 ? 'ões' : ''}
              </Badge>
            )}
            {gapCount > 0 && (
              <Badge variant="outline" className="border-orange-500 text-orange-500">
                {gapCount} Gap{gapCount > 1 ? 's' : ''} Curto{gapCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetails(true)}
              className="bg-background"
            >
              Ver Detalhes
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes dos Conflitos</DialogTitle>
            <DialogDescription>
              Lista completa de conflitos detectados no calendário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {conflicts.map((conflict, index) => (
              <div
                key={index}
                className="border rounded-lg p-4 space-y-3 bg-card"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground">
                      {conflict.propertyName}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {conflict.message}
                    </p>
                  </div>
                  <Badge
                    variant={
                      conflict.conflictType === 'overlap'
                        ? 'destructive'
                        : 'outline'
                    }
                    className={
                      conflict.conflictType === 'gap_too_short'
                        ? 'border-orange-500 text-orange-500'
                        : ''
                    }
                  >
                    {conflict.conflictType === 'overlap'
                      ? 'Sobreposição'
                      : 'Gap Curto'}
                  </Badge>
                </div>

                <div className="grid gap-2">
                  {conflict.reservations.map((reservation, rIndex) => (
                    <div
                      key={reservation.id}
                      className="flex items-center justify-between bg-muted/50 rounded p-3 text-sm"
                    >
                      <div>
                        <div className="font-medium text-foreground">
                          #{rIndex + 1} - {reservation.reservation_code}
                        </div>
                        <div className="text-muted-foreground">
                          {reservation.guest_name || 'Sem nome'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-foreground">
                          {format(new Date(reservation.check_in_date), 'dd/MM/yyyy')}
                          {' → '}
                          {format(new Date(reservation.check_out_date), 'dd/MM/yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {reservation.checkin_time || '15:00'} - {reservation.checkout_time || '11:00'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {conflict.conflictType === 'overlap' && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded p-3 text-sm">
                    <p className="text-destructive font-medium">
                      ⚠️ Atenção: As datas se sobrepõem. Uma das reservas precisa ser
                      ajustada ou cancelada.
                    </p>
                  </div>
                )}

                {conflict.conflictType === 'gap_too_short' && (
                  <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded p-3 text-sm">
                    <p className="text-orange-700 dark:text-orange-400 font-medium">
                      ⏰ Tempo insuficiente entre reservas para limpeza adequada.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ConflictAlert;
