import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { ChannelSyncSource, SyncPlatform } from '@/types/channelSync';
import type { Property } from '@/types/property';

interface SourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  source?: ChannelSyncSource | null;
  onSave: (input: {
    property_id: string;
    platform: SyncPlatform;
    ical_url: string;
    listing_alias?: string | null;
    is_active?: boolean;
    dtend_is_checkout?: boolean;
  }, id?: string) => Promise<void>;
}

const SourceDialog: React.FC<SourceDialogProps> = ({
  open, onOpenChange, properties, source, onSave,
}) => {
  const [propertyId, setPropertyId] = useState('');
  const [platform, setPlatform] = useState<SyncPlatform>('Airbnb');
  const [icalUrl, setIcalUrl] = useState('');
  const [listingAlias, setListingAlias] = useState('');
  // Linhas técnicas (identificador da acomodação) que o sistema aprende
  // sozinho: não aparecem no campo, mas são preservadas ao salvar.
  const [marcadores, setMarcadores] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPropertyId(source?.property_id ?? '');
    setPlatform((source?.platform as SyncPlatform) ?? 'Airbnb');
    setIcalUrl(source?.ical_url ?? '');
    const linhas = (source?.listing_alias ?? '')
      .split(/[\n|;]+/)
      .map((linha) => linha.trim())
      .filter(Boolean);
    setListingAlias(linhas.filter((linha) => !linha.startsWith('booking_hotel_id:')).join('\n'));
    setMarcadores(linhas.filter((linha) => linha.startsWith('booking_hotel_id:')));
    setIsActive(source?.is_active ?? true);
    setFormError(null);
  }, [open, source]);

  const handleSave = async () => {
    if (!propertyId) {
      setFormError('Selecione a propriedade.');
      return;
    }

    const trimmedUrl = icalUrl.trim();
    if (!/^https:\/\//i.test(trimmedUrl)) {
      setFormError('O link do calendário precisa começar com https://');
      return;
    }
    if (!/\.ics(\?|$)|ical/i.test(trimmedUrl)) {
      setFormError('Esse link não parece um calendário iCal (.ics). Confira no painel da plataforma.');
      return;
    }

    try {
      setSaving(true);
      setFormError(null);
      await onSave({
        property_id: propertyId,
        platform,
        ical_url: trimmedUrl,
        listing_alias: [
          ...listingAlias.split(/[\n|;]+/).map((linha) => linha.trim()).filter(Boolean),
          ...marcadores,
        ].join('\n'),
        is_active: isActive,
      }, source?.id);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar o calendário';
      setFormError(
        message.includes('duplicate') || message.includes('unique')
          ? 'Já existe um calendário dessa plataforma para essa propriedade.'
          : message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{source ? 'Editar calendário' : 'Conectar calendário'}</DialogTitle>
          <DialogDescription>
            Cole o link de exportação iCal do anúncio. Ele é lido periodicamente para
            trazer as datas ocupadas e criar as reservas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sync-property">Propriedade</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger id="sync-property">
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

          <div className="space-y-2">
            <Label htmlFor="sync-platform">Plataforma</Label>
            <Select value={platform} onValueChange={(value) => setPlatform(value as SyncPlatform)}>
              <SelectTrigger id="sync-platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Airbnb">Airbnb</SelectItem>
                <SelectItem value="Booking.com">Booking.com</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sync-url">Link iCal (.ics)</Label>
            <Input
              id="sync-url"
              value={icalUrl}
              onChange={(event) => setIcalUrl(event.target.value)}
              placeholder="https://www.airbnb.com.br/calendar/ical/12345678.ics?s=..."
            />
            <p className="text-xs text-gray-500">
              {platform === 'Airbnb'
                ? 'Airbnb: Calendário → Disponibilidade → Sincronizar calendários → Exportar calendário.'
                : 'Booking.com: Extranet → Tarifas e Disponibilidade → Sincronizar calendários → Exportar calendário.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sync-alias">Nomes do anúncio na plataforma (um por linha)</Label>
            <Textarea
              id="sync-alias"
              value={listingAlias}
              onChange={(event) => setListingAlias(event.target.value)}
              placeholder={'Studio próximo a Praia de Copacabana\nNome antigo do anúncio'}
              rows={3}
            />
            <p className="text-xs text-gray-500">
              Identifica a propriedade certa nos e-mails da plataforma quando você tem
              vários imóveis. Pode renomear o anúncio à vontade: o sistema reconhece
              títulos parecidos e guarda sozinho o nome novo. Preencher os nomes
              antigos ajuda a casar e-mails já recebidos.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="sync-active">Sincronização ativa</Label>
              <p className="text-xs text-gray-500">Desative para pausar sem apagar o link.</p>
            </div>
            <Switch id="sync-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SourceDialog;
