import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, MapPin, Calendar, Users, DollarSign, CheckCircle, CreditCard } from 'lucide-react';

const BatchReceiptTemplate = ({ reservations, receiptType = 'reservation', dateRange }) => {
  // Agrupar reservas por propriedade
  const groupedByProperty = reservations.reduce((acc, reservation) => {
    const propertyId = reservation.property_id;
    if (!acc[propertyId]) {
      acc[propertyId] = {
        property: reservation.properties,
        reservations: []
      };
    }
    acc[propertyId].reservations.push(reservation);
    return acc;
  }, {});

  // Definições visuais baseadas no tipo de recibo
  const isPayment = receiptType === 'payment';
  const headerColor = isPayment ? 'bg-green-700' : 'bg-blue-800';
  const docTitle = isPayment ? 'RECIBO CONSOLIDADO DE PAGAMENTOS' : 'RECIBO CONSOLIDADO DE RESERVAS';
  const DocIcon = isPayment ? CreditCard : FileText;

  // Função para calcular totais por propriedade
  const calculatePropertyTotals = (reservations) => {
    return reservations.reduce((totals, reservation) => {
      const commission = reservation.commission_amount ?? (reservation.total_revenue * (reservation.properties?.commission_rate || 0));
      const cleaningFeeValue = Number(reservation.cleaning_fee ?? reservation.properties?.cleaning_fee ?? 0);
      
      // Usar a mesma lógica exata do template individual
      const normalizedAllocation = (reservation.cleaning_allocation || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const shouldShowCleaningLine = (
        !normalizedAllocation || 
        (reservation.cleaner_user_id && normalizedAllocation !== 'proprietario' && normalizedAllocation !== 'anfitriao')
      );
      
      const cleaningDeduct = shouldShowCleaningLine ? cleaningFeeValue : 0;
      const baseNet = reservation.net_revenue ?? (reservation.total_revenue - commission);
      const ownerValue = Math.max(0, Number(baseNet));
      
      totals.totalRevenue += reservation.total_revenue || 0;
      totals.totalCommission += commission || 0;
      totals.totalCleaning += cleaningDeduct || 0;
      totals.totalOwner += ownerValue || 0;
      
      return totals;
    }, {
      totalRevenue: 0,
      totalCommission: 0,
      totalCleaning: 0,
      totalOwner: 0
    });
  };

  // Calcular totais gerais
  const generalTotals = calculatePropertyTotals(reservations);

  // Formatar moeda
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Formatar data
  const formatDate = (dateString) => {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const logoUrl = "https://raw.githubusercontent.com/riohdigital/rio-host-dashboard-hub/1f3ce8cefe06b84b4fda7379f78317ab3008560b/public/LOGO%20RIOH%20HOST.png";
  const qrCodeUrl = "https://app.riohost.com/recibos-consolidados";
  const qrCodeApiSrc = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrCodeUrl)}`;

  return (
    <div className="bg-white p-8 font-sans max-w-4xl mx-auto shadow-lg rounded-lg border border-gray-200">
      {/* Header Centralizado Profissional */}
      <header className="text-center py-8 bg-white border-b-2 border-gray-200">
        {/* Logo e Título Principal */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-blue-800 mb-2" style={{ letterSpacing: '2px' }}>
            Rioh Host
          </h1>
          <div className={`inline-block px-6 py-2 text-white text-lg font-bold rounded-lg ${headerColor}`} style={{ letterSpacing: '1px' }}>
            {docTitle}
          </div>
        </div>
        
        {/* Subtítulos */}
        <div className="mb-4 space-y-1">
          <p className="text-gray-600 font-semibold text-lg" style={{ letterSpacing: '1px' }}>
            RIOH HOST GESTÃO DE HOSPEDAGEM
          </p>
          <p className="text-gray-500 text-sm" style={{ letterSpacing: '0.5px' }}>
            Gestão Profissional de Propriedades para Hospedagem
          </p>
        </div>
        
        {/* Período em Destaque */}
        {dateRange && (
          <div className="bg-gray-100 inline-block px-6 py-2 rounded-lg border border-gray-300">
            <p className="text-gray-800 font-semibold" style={{ letterSpacing: '0.5px' }}>
              Período: {dateRange.start} a {dateRange.end}
            </p>
          </div>
        )}
        
        {/* Data de Emissão */}
        <p className="text-xs text-gray-500 mt-4" style={{ letterSpacing: '0.3px' }}>
          Emitido em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </header>

      <main className="p-6">

        {/* Propriedades e Reservas */}
        <div className="space-y-8">
        {Object.entries(groupedByProperty).map(([propertyId, propertyData]) => {
          const propertyTotals = calculatePropertyTotals(propertyData.reservations);
          
          return (
            <div key={propertyId} className="border rounded-lg p-6 bg-gray-50">
              {/* Nome da Propriedade */}
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                  {propertyData.property?.name || 'Propriedade Não Identificada'}
                </h2>
                <p className="text-gray-600 text-sm">
                  {propertyData.property?.address || ''}
                </p>
              </div>

              {/* Lista de Reservas */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Reservas ({propertyData.reservations.length})
                </h3>
                <div className="grid gap-2">
                  {propertyData.reservations.map((reservation) => (
                    <div key={reservation.id} className="bg-white p-3 rounded border text-sm">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                          <span className="font-mono font-medium text-blue-600">
                            {reservation.reservation_code}
                          </span>
                          <span className="flex items-center text-gray-600">
                            <Users className="w-3 h-3 mr-1" />
                            {reservation.guest_name || 'N/A'}
                          </span>
                          <span className="text-gray-500">
                            {formatDate(reservation.check_in_date)} a {formatDate(reservation.check_out_date)}
                          </span>
                        </div>
                        <div className="flex items-center text-green-600 font-medium">
                          <DollarSign className="w-3 h-3 mr-1" />
                          {formatCurrency(reservation.total_revenue || 0)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumo Financeiro da Propriedade */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                  Resumo Financeiro - {propertyData.property?.name}
                </h3>
                {isPayment ? (
                  <div className="text-xs text-gray-700 space-y-2 bg-gray-50 rounded border-l-2 border-gray-200 p-3">
                    <div className="flex justify-between">
                      <span>Total Recebido:</span>
                      <span className="font-medium">{formatCurrency(propertyTotals.totalRevenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Comissão:</span>
                      <span className="text-red-600">-{formatCurrency(propertyTotals.totalCommission)}</span>
                    </div>
                    {propertyTotals.totalCleaning > 0 && (
                      <div className="flex justify-between">
                        <span>Faxina:</span>
                        <span className="text-red-600">-{formatCurrency(propertyTotals.totalCleaning)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-gray-300 pt-2 mt-2 font-medium">
                      <span>Valor do Proprietário:</span>
                      <span className="text-green-600 text-lg font-bold">{formatCurrency(propertyTotals.totalOwner)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-gray-700 text-md">Valor Total do Proprietário:</p>
                    <p className="text-3xl font-bold text-green-600">{formatCurrency(propertyTotals.totalOwner)}</p>
                  </div>
                )}
              </div>
              </div>
            );
          })}
        </div>

        {/* Resumo Geral */}
        {Object.keys(groupedByProperty).length > 1 && (
          <section className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center mt-6">
            <div className="flex items-center justify-center mb-3">
              <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
              <h4 className="font-bold text-lg text-gray-800">📊 RESUMO GERAL</h4>
            </div>
            {isPayment ? (
              <div className="text-xs text-gray-700 space-y-2 bg-blue-50 rounded border-l-2 border-blue-300 p-3">
                <div className="flex justify-between">
                  <span>Total Geral Recebido:</span>
                  <span className="font-medium">{formatCurrency(generalTotals.totalRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Comissões:</span>
                  <span className="text-red-600">-{formatCurrency(generalTotals.totalCommission)}</span>
                </div>
                {generalTotals.totalCleaning > 0 && (
                  <div className="flex justify-between">
                    <span>Total Faxinas:</span>
                    <span className="text-red-600">-{formatCurrency(generalTotals.totalCleaning)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-blue-400 pt-2 mt-2 font-medium">
                  <span>Total Proprietários:</span>
                  <span className="text-green-600 text-xl font-bold">{formatCurrency(generalTotals.totalOwner)}</span>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-700 text-md">Valor Total Geral dos Proprietários:</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(generalTotals.totalOwner)}</p>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="bg-gray-800 text-white rounded-b-lg p-6 mt-8 flex justify-between items-center">
        <div className="text-sm">
          <p className="font-bold">RIOH HOST</p>
          <p>Telefone: (XX) XXXX-XXXX | E-mail: contato@riohost.com</p>
          <p className="mt-2 italic">"Gestão completa para seu imóvel, sem burocracia."</p>
          <p className="text-xs opacity-75 mt-2">
            Total de {reservations.length} reserva(s) • {Object.keys(groupedByProperty).length} propriedade(s)
          </p>
        </div>
        <div>
          <img src={qrCodeApiSrc} alt="QR Code para recibos consolidados" crossOrigin="anonymous"/>
        </div>
      </footer>
    </div>
  );
};

export default BatchReceiptTemplate;