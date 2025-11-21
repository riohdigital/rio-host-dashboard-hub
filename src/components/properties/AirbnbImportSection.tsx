import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Download, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Property } from '@/types/property';
import ImportLoadingState from './ImportLoadingState';

interface AirbnbImportSectionProps {
  onImportSuccess: (data: Partial<Property>) => void;
  onImportError: (error: string) => void;
}

const AirbnbImportSection = ({ onImportSuccess, onImportError }: AirbnbImportSectionProps) => {
  const [airbnbLink, setAirbnbLink] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const validateAirbnbLink = (link: string): boolean => {
    if (!link) return false;
    try {
      const url = new URL(link);
      return url.hostname.includes('airbnb.com');
    } catch {
      return false;
    }
  };

  const handleImport = async () => {
    // Validação do link
    if (!validateAirbnbLink(airbnbLink)) {
      toast({
        title: "Link inválido",
        description: "Por favor, insira um link válido do Airbnb.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos

    try {
      const response = await fetch('https://n8n-n8n.dgyrua.easypanel.host/webhook/detalhes_de_propriedade_airbnb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ airbnb_link: airbnbLink }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Mapear os dados retornados para o formato esperado
      const mappedData: Partial<Property> = {
        name: data.title || data.name,
        address: data.address,
        property_type: data.property_type,
        max_guests: data.max_guests ? parseInt(data.max_guests) : undefined,
        base_nightly_price: data.price_per_night || data.base_nightly_price,
        notes: data.description || data.notes,
        default_checkin_time: data.check_in_time || data.default_checkin_time,
        default_checkout_time: data.check_out_time || data.default_checkout_time,
        airbnb_link: airbnbLink, // Preencher automaticamente o link
      };

      // Remover campos undefined
      Object.keys(mappedData).forEach(key => {
        if (mappedData[key as keyof typeof mappedData] === undefined) {
          delete mappedData[key as keyof typeof mappedData];
        }
      });

      onImportSuccess(mappedData);
      setAirbnbLink(''); // Limpar o campo após sucesso
    } catch (error: any) {
      let errorMessage = 'Não foi possível importar os dados. Tente novamente.';
      
      if (error.name === 'AbortError') {
        errorMessage = 'A importação está demorando. Tente novamente em alguns instantes.';
      } else if (error.message.includes('404')) {
        errorMessage = 'Anúncio não encontrado. Verifique o link e tente novamente.';
      } else if (error.message.includes('400')) {
        errorMessage = 'Link inválido. Verifique o link e tente novamente.';
      }

      onImportError(errorMessage);
    } finally {
      setIsImporting(false);
    }
  };

  if (isImporting) {
    return <ImportLoadingState />;
  }

  return (
    <Card className="p-6 mb-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            Importar Dados do Airbnb
          </h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Cole o link do anúncio do Airbnb para preencher automaticamente os dados da propriedade.
        </p>

        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="url"
              placeholder="https://www.airbnb.com.br/rooms/..."
              value={airbnbLink}
              onChange={(e) => setAirbnbLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleImport();
                }
              }}
              className="bg-background"
            />
          </div>
          <Button
            type="button"
            onClick={handleImport}
            disabled={!airbnbLink || isImporting}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Importar
          </Button>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          <span>Os dados serão extraídos automaticamente do anúncio</span>
        </div>
      </div>
    </Card>
  );
};

export default AirbnbImportSection;
