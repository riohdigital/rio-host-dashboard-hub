import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Download, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Property } from '@/types/property';
import ImportLoadingState from './ImportLoadingState';
import { getPropertyFieldsSchema, getExpectedResponseFormat } from '@/utils/propertyFieldsSchema';

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
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos (IA pode demorar)

    try {
      const payload = {
        airbnb_link: airbnbLink,
        fields_to_extract: getPropertyFieldsSchema(),
        expected_response_format: getExpectedResponseFormat(),
        instructions: "Extraia os dados do anúncio do Airbnb e retorne APENAS um objeto JSON com os campos solicitados. Não inclua explicações, apenas o JSON."
      };

      console.log('📤 Payload enviado ao webhook:', payload);

      const response = await fetch('https://n8n-n8n.dgyrua.easypanel.host/webhook/detalhes_de_propriedade_airbnb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // LOGGING DETALHADO PARA DEBUG
      console.log('🔍 Resposta completa do webhook:', data);
      console.log('🔍 Tipo da resposta:', typeof data);
      console.log('🔍 É array?', Array.isArray(data));
      console.log('🔍 Chaves disponíveis:', Object.keys(data || {}));

      // Se for array, pegar o primeiro item
      const webhookData = Array.isArray(data) ? data[0] : data;
      console.log('🔍 Dados processados:', webhookData);

      // Mapear os dados retornados para o formato esperado
      const mappedData: Partial<Property> = {
        name: webhookData.title || webhookData.name,
        address: webhookData.address,
        property_type: webhookData.property_type,
        max_guests: webhookData.max_guests ? parseInt(webhookData.max_guests) : undefined,
        base_nightly_price: webhookData.price_per_night || webhookData.base_nightly_price,
        notes: webhookData.description || webhookData.notes,
        default_checkin_time: webhookData.check_in_time || webhookData.default_checkin_time,
        default_checkout_time: webhookData.check_out_time || webhookData.default_checkout_time,
        airbnb_link: airbnbLink, // Preencher automaticamente o link
      };

      // Remover campos undefined
      Object.keys(mappedData).forEach(key => {
        if (mappedData[key as keyof typeof mappedData] === undefined) {
          delete mappedData[key as keyof typeof mappedData];
        }
      });

      console.log('✅ Dados mapeados finais:', mappedData);

      // Validar se algum dado foi extraído
      if (Object.keys(mappedData).length === 0 || !mappedData.name) {
        throw new Error('Nenhum dado foi extraído do anúncio. Verifique o link e tente novamente.');
      }

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
          Abra seu painel do Airbnb, entre em <strong>Anúncios</strong>, selecione seu anúncio, copie a URL (www) e cole aqui.
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
