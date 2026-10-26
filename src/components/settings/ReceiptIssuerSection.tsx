import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_RECEIPT_ISSUER, ReceiptIssuer, useReceiptIssuer } from '@/hooks/useReceiptIssuer';

/** Configurações → Emissão de Comprovantes: quem aparece no Comprovante do Hóspede. */
const ReceiptIssuerSection = () => {
  const { issuer, loading, save } = useReceiptIssuer();
  const [form, setForm] = useState<ReceiptIssuer>(DEFAULT_RECEIPT_ISSUER);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { setForm(issuer); }, [issuer]);

  const set = (campo: keyof ReceiptIssuer) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((atual) => ({ ...atual, [campo]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await save(form);
      toast({ title: 'Salvo', description: 'Os próximos comprovantes sairão com estes dados.' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível salvar.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#6A6DDF] mb-2">Emissão de Comprovantes</h2>
        <p className="text-gray-600">Dados que aparecem no Comprovante do Hóspede (Relatórios → Gerador de Recibos).</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div className="space-y-2">
          <Label htmlFor="issuer_name">Nome do emissor *</Label>
          <Input id="issuer_name" value={form.issuer_name} onChange={set('issuer_name')} placeholder="Rioh Host" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="document">CPF ou CNPJ</Label>
          <Input id="document" value={form.document ?? ''} onChange={set('document')} placeholder="00.000.000/0001-00" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" value={form.phone ?? ''} onChange={set('phone')} placeholder="(21) 99999-9999" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={form.email ?? ''} onChange={set('email')} placeholder="contato@exemplo.com" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Endereço</Label>
          <Input id="address" value={form.address ?? ''} onChange={set('address')} placeholder="Rua, número, cidade - UF" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="footer_note">Observação no rodapé</Label>
          <Textarea id="footer_note" value={form.footer_note ?? ''} onChange={set('footer_note')} placeholder="Ex.: Obrigado pela preferência!" rows={2} />
        </div>
        <Button type="submit" disabled={saving} className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white">
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </form>
    </div>
  );
};

export default ReceiptIssuerSection;
