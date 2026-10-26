import React from 'react';
import { Calendar, MapPin, User, Moon, Receipt, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateSafe } from '@/lib/dateUtils';
import { formatMonthLabel } from '@/lib/guestReceipts';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

/**
 * Comprovante do Hóspede: quanto o hóspede pagou no mês.
 * Mostra só o valor pago (sem limpeza, comissão ou repasse do anfitrião).
 * `receipt` vem de buildGuestMonthReceipts; `issuer` de useReceiptIssuer.
 */
const GuestReceiptTemplate = ({ receipt, issuer }) => {
  if (!receipt) return null;

  const { reservation } = receipt;
  const emissor = issuer?.issuer_name || 'Rioh Host';
  const contatos = [issuer?.phone, issuer?.email].filter(Boolean).join(' | ');
  const logoUrl = 'https://raw.githubusercontent.com/riohdigital/rio-host-dashboard-hub/1f3ce8cefe06b84b4fda7379f78317ab3008560b/public/LOGO%20RIOH%20HOST.png';
  const mostrarLogo = emissor === 'Rioh Host';
  const pago = reservation.payment_status === 'Pago';

  return (
    <div className="bg-white p-8 font-sans max-w-4xl mx-auto shadow-lg rounded-lg border border-gray-200">
      <header className="p-4 text-white rounded-t-lg bg-blue-800 flex justify-between items-center">
        {mostrarLogo
          ? <img src={logoUrl} alt={emissor} className="h-10" crossOrigin="anonymous" />
          : <p className="text-xl font-bold">{emissor}</p>}
        <div className="text-right">
          <div className="flex items-center justify-end gap-2"><Receipt className="h-6 w-6" /><h2 className="text-2xl font-bold">Comprovante do Hóspede</h2></div>
          <p className="text-xs opacity-90 mt-1">Emitido em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
      </header>

      <main className="p-6">
        <section className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Referência: <strong>{formatMonthLabel(receipt.monthKey)}</strong></p>
            <p className="text-sm text-gray-600">Código da Reserva: <strong>{reservation.reservation_code}</strong></p>
            <p className="text-sm text-gray-600">Canal: <strong>{reservation.platform}</strong></p>
          </div>
          <div className="text-right pl-4">
            <p className="text-gray-700 text-md">Valor pago no mês:</p>
            <p className="text-3xl font-bold text-blue-800">{formatCurrency(receipt.amount)}</p>
            {receipt.spansMonths && (
              <p className="text-xs text-gray-500 mt-1">
                {receipt.nightsInMonth} de {receipt.totalNights} noites · total da estadia {formatCurrency(receipt.stayTotal)}
              </p>
            )}
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="flex items-start"><User className="h-5 w-5 mr-3 mt-1 text-gray-500" /><div><strong>Hóspede</strong><p className="text-gray-700">{reservation.guest_name || 'Não informado'}</p></div></div>
          <div className="flex items-start"><MapPin className="h-5 w-5 mr-3 mt-1 text-gray-500" /><div><strong>Imóvel</strong><p className="text-gray-700">{reservation.properties?.name || 'N/A'}</p>{reservation.properties?.address && <p className="text-gray-500 text-sm">{reservation.properties.address}</p>}</div></div>
          <div className="flex items-start"><Calendar className="h-5 w-5 mr-3 mt-1 text-gray-500" /><div><strong>Período no mês</strong><p className="text-gray-700">{formatDateSafe(receipt.periodStart)} a {formatDateSafe(receipt.periodEnd)}</p></div></div>
          <div className="flex items-start"><Moon className="h-5 w-5 mr-3 mt-1 text-gray-500" /><div><strong>Noites no mês</strong><p className="text-gray-700">{receipt.nightsInMonth}</p></div></div>
          {receipt.spansMonths && (
            <div className="flex items-start md:col-span-2"><Calendar className="h-5 w-5 mr-3 mt-1 text-gray-500" /><div><strong>Estadia completa</strong><p className="text-gray-700">{formatDateSafe(reservation.check_in_date)} a {formatDateSafe(reservation.check_out_date)}</p></div></div>
          )}
        </section>

        <section className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
            <h4 className="font-bold text-lg text-gray-800">{pago ? 'Pagamento recebido' : 'Valor referente ao período'}</h4>
          </div>
          <p className="text-gray-700 mt-2">
            {pago
              ? `Declaramos que recebemos de ${reservation.guest_name || 'o hóspede'} o valor de ${formatCurrency(receipt.amount)} referente à hospedagem em ${formatMonthLabel(receipt.monthKey).toLowerCase()}.`
              : `Valor de ${formatCurrency(receipt.amount)} referente à hospedagem em ${formatMonthLabel(receipt.monthKey).toLowerCase()}.`}
          </p>
        </section>
      </main>

      <footer className="bg-gray-800 text-white rounded-b-lg p-6 mt-8 text-sm">
        <p className="font-bold">{emissor.toUpperCase()}</p>
        {issuer?.document && <p>CPF/CNPJ: {issuer.document}</p>}
        {issuer?.address && <p>{issuer.address}</p>}
        {contatos && <p>{contatos}</p>}
        {issuer?.footer_note && <p className="mt-2 italic">{issuer.footer_note}</p>}
      </footer>
    </div>
  );
};

export default GuestReceiptTemplate;
