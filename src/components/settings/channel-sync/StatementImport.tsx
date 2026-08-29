import React, { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Property } from '@/types/property';
import {
  parseStatementFile,
  type StatementFile,
  type StatementRow,
} from '@/utils/statementParsers';

interface RowOutcome {
  reservationCode: string;
  action: 'created' | 'updated' | 'skipped' | 'pending' | 'ignored';
  reason?: string;
}

interface ImportResponse {
  ok: boolean;
  dryRun: boolean;
  totals: Record<string, number>;
  results: RowOutcome[];
}

const moeda = (valor: number | null) =>
  valor === null
    ? '—'
    : valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dataCurta = (iso: string | null) =>
  iso ? iso.split('-').reverse().slice(0, 2).join('/') : '?';

interface StatementImportProps {
  properties: Property[];
  onImported: () => void;
}

const StatementImport: React.FC<StatementImportProps> = ({ properties, onImported }) => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [arquivo, setArquivo] = useState<StatementFile | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [previa, setPrevia] = useState<ImportResponse | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O extrato do Booking.com sai de dentro de uma acomodação e não diz qual é;
  // o do Airbnb nomeia o anúncio em cada linha e se resolve sozinho.
  const precisaEscolherImovel = arquivo?.platform === 'Booking.com';

  const resultadoPorCodigo = useMemo(() => {
    const mapa = new Map<string, RowOutcome>();
    for (const item of previa?.results ?? []) mapa.set(item.reservationCode, item);
    return mapa;
  }, [previa]);

  const limpar = () => {
    setArquivo(null);
    setNomeArquivo('');
    setPropertyId('');
    setPrevia(null);
    setErro(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const aoEscolherArquivo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setOcupado(true);
    setErro(null);
    setPrevia(null);

    try {
      const lido = await parseStatementFile(file);
      if (lido.rows.length === 0) {
        throw new Error('Não encontrei nenhuma reserva neste arquivo.');
      }
      setArquivo(lido);
      setNomeArquivo(file.name);
      setPropertyId('');
    } catch (err) {
      limpar();
      setErro(err instanceof Error ? err.message : 'Não consegui ler o arquivo.');
    } finally {
      setOcupado(false);
    }
  };

  const chamarFuncao = async (dryRun: boolean): Promise<ImportResponse> => {
    const { data, error } = await supabase.functions.invoke('import-platform-statement', {
      body: {
        platform: arquivo!.platform,
        propertyId: precisaEscolherImovel ? propertyId : null,
        dryRun,
        rows: arquivo!.rows.map((linha: StatementRow) => ({
          reservationCode: linha.reservationCode,
          guestName: linha.guestName,
          checkIn: linha.checkIn,
          checkOut: linha.checkOut,
          numberOfGuests: linha.numberOfGuests,
          totalRevenue: linha.totalRevenue,
          platformCommission: linha.platformCommission,
          listingName: linha.listingName,
          cancelled: linha.cancelled,
        })),
      },
    });

    if (error) throw error;
    return data as ImportResponse;
  };

  const conferir = async () => {
    setOcupado(true);
    setErro(null);
    try {
      setPrevia(await chamarFuncao(true));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao conferir o arquivo.');
    } finally {
      setOcupado(false);
    }
  };

  const importar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await chamarFuncao(false);
      toast({
        title: 'Extrato importado',
        description: `${resultado.totals.created} reserva(s) criada(s), ${resultado.totals.updated} completada(s).`,
      });
      limpar();
      onImported();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao importar.');
    } finally {
      setOcupado(false);
    }
  };

  const etiqueta = (codigo: string) => {
    const resultado = resultadoPorCodigo.get(codigo);
    if (!resultado) return null;

    switch (resultado.action) {
      case 'created':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Cria</Badge>;
      case 'updated':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Completa</Badge>;
      case 'skipped':
        return <Badge variant="secondary">Sem mudança</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Conferir</Badge>;
      default:
        return <Badge variant="outline">Fora</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importar valores do extrato
        </CardTitle>
        <CardDescription>
          Nem o calendário nem os e-mails informam quanto a reserva rendeu. O valor vem
          do extrato: no Booking.com, <strong>Reservas → Exportar</strong>; no Airbnb,{' '}
          <strong>Ganhos → Histórico de transações</strong>. É gravado o líquido, já sem
          a comissão da plataforma.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={aoEscolherArquivo}
            className="hidden"
            id="statement-file"
          />
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={ocupado}>
            <Upload className="h-4 w-4 mr-2" />
            Escolher arquivo
          </Button>
          {nomeArquivo && <span className="text-sm text-gray-600">{nomeArquivo}</span>}
          {arquivo && <Badge variant="outline">{arquivo.platform}</Badge>}
        </div>

        {erro && (
          <Alert variant="destructive">
            <AlertTitle>Não deu para seguir</AlertTitle>
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        {arquivo && (
          <>
            {precisaEscolherImovel && (
              <div className="space-y-2">
                <p className="text-sm">
                  O extrato do Booking.com não diz a qual imóvel pertence — ele é exportado
                  de dentro de cada acomodação. Escolha qual é este arquivo:
                </p>
                <Select value={propertyId} onValueChange={setPropertyId}>
                  <SelectTrigger className="sm:w-80">
                    <SelectValue placeholder="Selecione a propriedade" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.nickname || property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Código</th>
                    <th className="px-3 py-2 font-medium">Hóspede</th>
                    <th className="px-3 py-2 font-medium">Período</th>
                    <th className="px-3 py-2 font-medium text-right">Líquido</th>
                    {previa && <th className="px-3 py-2 font-medium">O que acontece</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {arquivo.rows.map((linha) => (
                    <tr key={linha.reservationCode} className={linha.warning ? 'bg-amber-50' : ''}>
                      <td className="px-3 py-2 font-mono text-xs">{linha.reservationCode}</td>
                      <td className="px-3 py-2">{linha.guestName ?? '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {dataCurta(linha.checkIn)} → {dataCurta(linha.checkOut)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {moeda(linha.totalRevenue)}
                      </td>
                      {previa && <td className="px-3 py-2">{etiqueta(linha.reservationCode)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {arquivo.rows.some((linha) => linha.warning) && (
              <Alert>
                <AlertTitle>Linhas destacadas em amarelo</AlertTitle>
                <AlertDescription className="space-y-1">
                  {arquivo.rows.filter((linha) => linha.warning).map((linha) => (
                    <div key={linha.reservationCode} className="text-xs">
                      <span className="font-mono">{linha.reservationCode}</span>: {linha.warning}
                    </div>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={conferir}
                disabled={ocupado || (precisaEscolherImovel && !propertyId)}
              >
                {ocupado && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Conferir antes de importar
              </Button>
              <Button
                onClick={importar}
                disabled={ocupado || !previa || (precisaEscolherImovel && !propertyId)}
                className="bg-[#6A6DDF] hover:bg-[#5A5BCF]"
              >
                Importar {previa ? `${previa.totals.created + previa.totals.updated} reserva(s)` : ''}
              </Button>
              <Button variant="ghost" onClick={limpar} disabled={ocupado}>
                Cancelar
              </Button>
            </div>

            {previa && (
              <p className="text-xs text-gray-500">
                {previa.totals.created} para criar · {previa.totals.updated} para completar ·{' '}
                {previa.totals.skipped} sem mudança · {previa.totals.pending} precisam de conferência.
                Valores já gravados à mão não são sobrescritos.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default StatementImport;
