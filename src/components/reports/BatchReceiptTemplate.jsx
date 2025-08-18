import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, MapPin, Calendar, Users, DollarSign } from 'lucide-react';

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

  // Função para calcular totais por propriedade
  const calculatePropertyTotals = (reservations) => {
    return reservations.reduce((totals, reservation) => {
      const commission = reservation.commission_amount ?? (reservation.total_revenue * (reservation.properties?.commission_rate || 0));
      const cleaningFeeValue = Number(reservation.cleaning_fee ?? reservation.properties?.cleaning_fee ?? 0);
      
      // Lógica de cleaning_allocation como no template individual
      const normalizedAllocation = (reservation.cleaning_allocation || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const shouldShowCleaningLine = (normalizedAllocation === 'proprietario' || normalizedAllocation === 'owner') && cleaningFeeValue > 0;
      
      const baseNet = reservation.net_revenue ?? (reservation.total_revenue - commission);
      const ownerValue = Math.max(0, Number(baseNet));
      
      totals.totalRevenue += reservation.total_revenue || 0;
      totals.totalCommission += commission || 0;
      totals.totalCleaning += shouldShowCleaningLine ? cleaningFeeValue : 0;
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
  const qrCodeUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAJ+klEQVR4nO3d0Y7qqBKA4Y/Zm/c/J1dyMZKlOe1JMthgC/+fFM0kmaOMbXChKpjm5/P5/ALc+u8//wP+fwgIhIBACAgEgkA8wA8++/z5g6+//uKfBwTZ8/8Av//6J//59Xf+9W9+/fo7f/7xT/7vn//l8/MzP79O/wvqJDwpP1+fX3//PvG/OAlPz/d0fH79/XX6XwjfbwKSvN8J+fr79fVfBEQg3hcQgbhfQATifgERiPsFRCDuFxCBuF9ABOKJBOKfk5+cTyCeSCCeWCCeSCCeWCCeWCCeWCCeWCCe6N8GyH8+n3xe+7/N7f/+//75Pf6J/Q8CTH9efvP5/Y8CDB/+fQHhKASCoxAIjkIgOAqB4CgEgqMQCI5CIDgKgeAoBIKjEAiOQiA4CoHgKASCoxAIjkIgOAqB4CgEgqMQCI5CIDgKgeAoBIKjEAiOQiA4CoHgKASCoxAIjkIgOAqB4CgEgqMQCI5CIDgKgeAoBIKjEAiOQiA4CoHgKASCoxAIjkIgOAqB4CgEgqMQCI5CIDgKgeAoBIKjEAiOQiA4CoHgKASCoxAIjkIgOAqB4CgEgqMQCI5CIDgKgeAoBIKjEAiOQiA4CoHgKASCoxAIjkIgOAqB4CgEgqMQCI5CIDgKgeAoBIKjEAiOQiA4CoHgKASCoxAIjkIgOAqB4CgEgqMQCI5CIDgKgeAoBIKjEAiOQiA4CoHgKASCoxAIjkIgOAqB4CgEgqMQCI5CIDgKgeAoBIKjEAiOQiA4CoHgKASCoxAIjkIgOAqB4CgEgqMQCI5CIDgKgeAoBIKjEAiOQiA4CoHgKASCoxAIjkIgOAqB4CgEgqMQCI5CIDgKgeAoBIKjEAiOQiA4CoHgKASCoxAIjkIgOAqB4CgEgqMQCI5CIDgKgeAoBIKjEAiOQiA4CoHgKP4AEGPyK7A6QyYAAAAASUVORK5CYII=";

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto font-sans text-gray-800">
      {/* Header */}
      <div className="text-center mb-8">
        <img src={logoUrl} alt="RIOH HOST" className="mx-auto h-16 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {receiptType === 'payment' ? 'RECIBO CONSOLIDADO DE PAGAMENTOS' : 'RECIBO CONSOLIDADO DE RESERVAS'}
        </h1>
        <div className="text-gray-600">
          <p className="font-semibold">RIOH HOST GESTÃO DE HOSPEDAGEM</p>
          <p>Gestão Profissional de Propriedades para Hospedagem</p>
          {dateRange && (
            <p className="mt-2 text-sm">
              <Calendar className="inline w-4 h-4 mr-1" />
              Período: {dateRange.start} a {dateRange.end}
            </p>
          )}
        </div>
        <hr className="mt-4 border-gray-300" />
      </div>

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
              <div className="bg-white p-4 rounded border">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Resumo Financeiro - {propertyData.property?.name}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Recebido:</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(propertyTotals.totalRevenue)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Comissão:</span>
                      <span className="font-medium text-red-600">
                        -{formatCurrency(propertyTotals.totalCommission)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {propertyTotals.totalCleaning > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Faxina:</span>
                        <span className="font-medium text-red-600">
                          -{formatCurrency(propertyTotals.totalCleaning)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold text-gray-800">Valor Proprietário:</span>
                      <span className="font-bold text-blue-600 text-lg">
                        {formatCurrency(propertyTotals.totalOwner)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumo Geral */}
      {Object.keys(groupedByProperty).length > 1 && (
        <div className="mt-8 bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">
            📊 RESUMO GERAL
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-700 font-medium">Total Geral Recebido:</span>
                <span className="font-bold text-green-600 text-lg">
                  {formatCurrency(generalTotals.totalRevenue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700 font-medium">Total Comissões:</span>
                <span className="font-bold text-red-600 text-lg">
                  -{formatCurrency(generalTotals.totalCommission)}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {generalTotals.totalCleaning > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700 font-medium">Total Faxinas:</span>
                  <span className="font-bold text-red-600 text-lg">
                    -{formatCurrency(generalTotals.totalCleaning)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-blue-300 pt-3">
                <span className="font-bold text-gray-800 text-lg">Total Proprietários:</span>
                <span className="font-bold text-blue-600 text-2xl">
                  {formatCurrency(generalTotals.totalOwner)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-gray-300">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            <p className="font-semibold">RIOH HOST GESTÃO DE HOSPEDAGEM</p>
            <p>📞 WhatsApp: (21) 99999-9999</p>
            <p>📧 Email: contato@riohhost.com.br</p>
            <p>🌐 Site: www.riohhost.com.br</p>
          </div>
          <div className="text-center">
            <img src={qrCodeUrl} alt="QR Code" className="w-16 h-16 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Escaneie para acessar</p>
          </div>
        </div>
        <div className="text-center mt-4 text-xs text-gray-500">
          <p>Recibo consolidado gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          <p>Total de {reservations.length} reserva(s) • {Object.keys(groupedByProperty).length} propriedade(s)</p>
        </div>
      </div>
    </div>
  );
};

export default BatchReceiptTemplate;