import React, { useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NotificationDestination, useNotificationDestinations } from '@/hooks/useNotificationDestinations';

interface AuthenticationDialogProps {
  destination: NotificationDestination;
  onClose: () => void;
}

const AuthenticationDialog = ({ destination, onClose }: AuthenticationDialogProps) => {
  const { updateDestination } = useNotificationDestinations();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [authCode, setAuthCode] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateAuthCode = async () => {
    // Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Gerar QR Code
    try {
      const qrUrl = await QRCode.toDataURL(`AUTH:${code}:${destination.id}`);
      setQrCodeUrl(qrUrl);
      setAuthCode(code);

      // Salvar código no banco com expiração de 10 minutos
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      await updateDestination(destination.id, {
        auth_code: code,
        auth_code_expires_at: expiresAt.toISOString()
      });
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
    }
  };

  const confirmAuthentication = async () => {
    await updateDestination(destination.id, {
      is_authenticated: true,
      auth_code: null,
      auth_code_expires_at: null
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Autenticar {destination.destination_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!qrCodeUrl ? (
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Clique no botão abaixo para gerar um código de autenticação
              </p>
              <Button onClick={generateAuthCode}>
                Gerar Código QR
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <img src={qrCodeUrl} alt="QR Code" className="mx-auto mb-4" />
                <div className="space-y-2">
                  <Label>Código de Autenticação:</Label>
                  <Input value={authCode} readOnly className="text-center font-mono text-lg" />
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>• Escaneie o QR Code ou digite o código no WhatsApp</p>
                <p>• O código expira em 10 minutos</p>
                <p>• Confirme quando o destinatário estiver autenticado</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={generateAuthCode} className="flex-1">
                  Gerar Novo Código
                </Button>
                <Button onClick={confirmAuthentication} className="flex-1">
                  Confirmar Autenticação
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthenticationDialog;