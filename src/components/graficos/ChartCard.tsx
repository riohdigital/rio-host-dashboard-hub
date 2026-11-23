import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEhCelular } from '@/hooks/useMidia';
import { cn } from '@/lib/utils';

interface ChartCardProps {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  icone?: React.ReactNode;
  /** Controles à direita do título (ex.: seletor Mensal/Anual) */
  acoes?: React.ReactNode;
  /** Destaque numérico acima do gráfico */
  destaque?: React.ReactNode;
  carregando?: boolean;
  vazio?: boolean;
  mensagemVazio?: string;
  /** Legenda embaixo do gráfico */
  legenda?: React.ReactNode;
  /** Recebe a altura padrão (220px celular, 300px desktop) */
  children: (altura: number) => React.ReactNode;
  className?: string;
  alturaCelular?: number;
  alturaDesktop?: number;
}

/** Cartão padrão dos gráficos: título, destaque, gráfico, legenda, esqueleto e estado vazio */
const ChartCard = ({
  titulo,
  subtitulo,
  icone,
  acoes,
  destaque,
  carregando,
  vazio,
  mensagemVazio = 'Sem dados no período selecionado.',
  legenda,
  children,
  className,
  alturaCelular = 220,
  alturaDesktop = 300,
}: ChartCardProps) => {
  const celular = useEhCelular();
  const altura = celular ? alturaCelular : alturaDesktop;

  return (
    <Card className={cn('h-full bg-white', className)}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            {icone}
            {titulo}
          </CardTitle>
          {subtitulo && <p className="mt-1 text-xs text-gray-500 sm:text-sm">{subtitulo}</p>}
        </div>
        {acoes}
      </CardHeader>
      <CardContent>
        {destaque && <div className="mb-3">{destaque}</div>}
        {carregando ? (
          <div className="flex flex-col justify-end gap-2" style={{ height: altura }} aria-busy="true" aria-label="Carregando gráfico">
            <div className="flex h-full items-end gap-2">
              {[40, 65, 50, 80, 55, 70, 45].map((h, i) => (
                <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        ) : vazio ? (
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center text-sm text-gray-500"
            style={{ height: altura }}
          >
            <BarChart3 className="h-6 w-6 text-gray-300" aria-hidden="true" />
            {mensagemVazio}
          </div>
        ) : (
          <>
            <div style={{ height: altura }}>{children(altura)}</div>
            {legenda}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ChartCard;
