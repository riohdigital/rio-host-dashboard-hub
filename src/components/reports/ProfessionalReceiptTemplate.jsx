import React from 'react';
import { Calendar, MapPin, User, Users, Moon, FileText, CheckCircle, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Função auxiliar interna para formatação de moeda
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

// Componente do Template Visual
const ProfessionalReceiptTemplate = ({ reservation, receiptType = 'reservation' }) => {
  if (!reservation) return null;

  // Definições visuais baseadas no tipo de recibo
  const isPayment = receiptType === 'payment';
  const headerColor = isPayment ? 'bg-green-700' : 'bg-blue-800';
  const docTitle = isPayment ? 'Recibo de Pagamento' : 'Confirmação de Reserva';
  const DocIcon = isPayment ? CreditCard : FileText;
  const institutionalMessage = isPayment 
    ? { icon: <CheckCircle className="h-5 w-5 text-green-600 mr-2" />, text: 'O valor referente à reserva foi repassado com sucesso à sua conta cadastrada.', title: 'Pagamento Recebido e Efetuado' }
    : { icon: <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />, text: 'O imóvel estará ocupado no período informado. Certifique-se de que ele esteja pronto para receber os hóspedes.', title: 'Estadia Confirmada com Sucesso' };

  // Cálculos de dados
  const checkIn = new Date(reservation.check_in_date);
  const checkOut = new Date(reservation.check_out_date);
  const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
  const ownerValue = (reservation.net_revenue ?? (reservation.total_revenue - (reservation.commission_amount || 0)));

  // Links para Logo e QR Code
  const logoUrl = "https://raw.githubusercontent.com/riohdigital/rio-host-dashboard-hub/1f3ce8cefe06b84b4fda7379f78317ab3008560b/public/LOGO%20RIOH%20HOST.png";
  const qrCodeUrl = `https://app.riohost.com/verificar-reserva/${reservation.reservation_code}`;
  const qrCodeApiSrc = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrCodeUrl)}`;

  return (
    <div className="bg-white p-8 font-sans max-w-4xl mx-auto shadow-lg rounded-lg border border-gray-200">
       <header className={`p-4 text-white rounded-t-lg ${headerColor} flex justify-between items-center`}>
        <img src={logoUrl} alt="Rioh Host Logo" className="h-10" crossOrigin="anonymous" />
        <div className="text-right">
          <div className="flex items-center justify-end gap-2"><DocIcon className="h-6 w-6" /><h2 className="text-2xl font-bold">{docTitle}</h2></div>
          <p className="text-xs opacity-90 mt-1">Emitido em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
      </header>
      <main className="p-6">
        <section className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">Código da Reserva: <strong>{reservation.reservation_code}</strong></p>
              <p className="text-sm text-gray-600">Propriedade: <strong>{reservation.properties?.name || 'N/A'}</strong></p>
              <p className="text-sm text-gray-600">Plataforma: <strong>{reservation.platform}</strong></p>
            </div>
            <div className="text-right pl-4">
              <p className="text-gray-700 text-md">Valor do Proprietário:</p><p className="text-3xl font-bold text-green-600">{formatCurrency(ownerValue)}</p>
            </div>
          </div>
        </section>
        <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div className="flex items-start"><MapPin className="h-5 w-5 mr-3 mt-1 text-gray-500" /><div><strong>Endereço</strong><p className="text-gray-700">{reservation.properties?.address || 'N/A'}</p></div></div>
            <div className="flex items-start"><User className="h-5 w-5 mr-3 mt-1 text-gray-500" /><div><strong>Hóspede</strong><p className="text-gray-700">{reservation.guest_name}</p></div></div>
            <div className="flex items-start"><Users className="h-5 w-5 mr-3 mt-1 text-gray-500" /><div><strong>Hóspedes</strong><p className="text-gray-700">{reservation.number_of_guests}</p></div></div>
            <div className="flex items-start"><Moon className="h-5 w-5 mr-3 mt-1 text-gray-500" /><div><strong>Noites</strong><p className="text-gray-700">{nights}</p></div></div>
            <div className="flex items-start"><Calendar className="h-5 w-5 mr-3 mt-1 text-gray-500" /><div><strong>Check-in</strong><p className="text-gray-700">{format(checkIn, "dd/MM/yyyy 'às' 14:00", { locale: ptBR })}</p></div></div>
            <div className="flex items-start"><Calendar className="h-5 w-5 mr-3 mt-1 text-gray-500" /><div><strong>Check-out</strong><p className="text-gray-700">{format(checkOut, "dd/MM/yyyy 'às' 11:00", { locale: ptBR })}</p></div></div>
          </div>
        </section>
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center">{institutionalMessage.icon}<h4 className="font-bold text-lg text-gray-800">{institutionalMessage.title}</h4></div>
            <p className="text-gray-700 mt-2">{institutionalMessage.text}</p>
        </section>
      </main>
      <footer className="bg-gray-800 text-white rounded-b-lg p-6 mt-8 flex justify-between items-center">
        <div className="text-sm"><p className="font-bold">RIOH HOST</p><p>Telefone: (XX) XXXX-XXXX | E-mail: contato@riohost.com</p><p className="mt-2 italic">“Gestão completa para seu imóvel, sem burocracia.”</p></div>
        <div><img src={qrCodeApiSrc} alt={`QR Code para reserva ${reservation.reservation_code}`} crossOrigin="anonymous"/></div>
      </footer>
    </div>
  );
};

export default ProfessionalReceiptTemplate;
