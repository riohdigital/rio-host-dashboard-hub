
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import JanelaResponsiva from "@/components/comum/JanelaResponsiva";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Users, DollarSign, Link2, Trash2, Edit, Home, FolderOpen, Building2, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import PropertyForm from './PropertyForm';
import PropriedadesCelular from './PropriedadesCelular';
import { BotaoExcluir } from '@/components/comum/FolhaDetalhes';
import { useEhCompacto } from '@/hooks/useMidia';
import { Property } from '@/types/property';
import { useItemAberto } from '@/hooks/useItemAberto';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';
import AbasRolaveis from '@/components/comum/AbasRolaveis';
import DocumentosImoveis, { TODOS_OS_IMOVEIS } from '@/components/documentos/DocumentosImoveis';

const PropertiesList = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  // Janela do cadastro (novo ou edição): volta aberta ao recarregar a página
  const janelaCadastro = useItemAberto('imoveis.form', properties, { carregando: loading });
  const dialogOpen = janelaCadastro.aberto;
  const editingProperty = janelaCadastro.item;
  const { toast } = useToast();
  const { hasPermission, canAccessProperty, getAccessibleProperties, isMaster } = useUserPermissions();
  // ?editar=<id> abre o cadastro direto (vem do pedido de "Atualizar cadastro" da Precificação).
  const [searchParams, setSearchParams] = useSearchParams();
  const editarId = searchParams.get('editar');
  const compacto = useEhCompacto();
  // Aba Imóveis | Documentos e o imóvel escolhido nos documentos: voltam ao recarregar
  const [aba, setAba] = useEstadoPersistente<'imoveis' | 'documentos'>('imoveis.aba', 'imoveis', { aceita: ['imoveis', 'documentos'] });
  const [filtroDocumentos, setFiltroDocumentos] = useEstadoPersistente('documentos.imovel', TODOS_OS_IMOVEIS);
  const verDocumentos = (imovelId: string) => {
    setFiltroDocumentos(imovelId);
    setAba('documentos');
    janelaCadastro.limpar();
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter properties based on user permissions
      let filteredProperties = data || [];
      if (!isMaster() && !hasPermission('properties_view_all')) {
        const accessiblePropertyIds = getAccessibleProperties();
        filteredProperties = data?.filter(property => 
          accessiblePropertyIds.includes(property.id)
        ) || [];
      }

      setProperties(filteredProperties);
    } catch (error) {
      console.error('Erro ao buscar propriedades:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as propriedades.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    fetchProperties();
    janelaCadastro.limpar();
  };

  const handleCancel = () => {
    janelaCadastro.limpar();
  };

  const handleEdit = (property: Property) => {
    const accessLevel = canAccessProperty(property.id);
    if (accessLevel === 'full' || (accessLevel === 'read_only' && hasPermission('properties_edit'))) {
      janelaCadastro.abrir(property);
    } else {
      toast({
        title: "Erro",
        description: "Você não tem permissão para editar esta propriedade.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!editarId || loading) return;
    const alvo = properties.find(p => p.id === editarId);
    if (alvo) handleEdit(alvo);
    searchParams.delete('editar');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editarId, loading, properties]);

  const podeExcluir = (propertyId: string) =>
    canAccessProperty(propertyId) === 'full' && hasPermission('properties_delete');

  const podeEditar = (propertyId: string) => {
    const accessLevel = canAccessProperty(propertyId);
    return accessLevel === 'full' || (accessLevel === 'read_only' && hasPermission('properties_edit'));
  };

  const handleDelete = async (propertyId: string) => {
    if (!podeExcluir(propertyId)) {
      toast({
        title: "Erro",
        description: "Você não tem permissão para excluir esta propriedade.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm('Tem certeza que deseja excluir esta propriedade?')) return;
    await excluirImovel(propertyId);
  };

  // Exclui sem perguntar (no celular, o botão de dentro do imóvel já confirmou)
  const excluirImovel = async (propertyId: string) => {
    if (!podeExcluir(propertyId)) return;
    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Propriedade excluída com sucesso.",
      });
      
      fetchProperties();
      if (editingProperty?.id === propertyId) handleCancel();
    } catch (error) {
      console.error('Erro ao excluir propriedade:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a propriedade.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'Ativo' ? 'bg-success-100 text-success-800' : 'bg-danger-100 text-danger-800';
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const janela = (
    <JanelaResponsiva
      aberta={dialogOpen}
      aoMudar={(a) => { if (!a) handleCancel(); }}
      titulo={editingProperty ? 'Editar Propriedade' : 'Nova Propriedade'}
      telaCheia
      largura="xl"
    >
      {editingProperty && (
        <button
          type="button"
          onClick={() => verDocumentos(editingProperty.id)}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl border bg-card px-3.5 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand"><FolderOpen className="h-[18px] w-[18px]" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">Documentos deste imóvel</span>
            <span className="block text-xs text-gray-500">Dedetização, contratos, seguros e outros arquivos</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        </button>
      )}
      <PropertyForm
        property={editingProperty}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        excluir={
          compacto && editingProperty && podeExcluir(editingProperty.id) ? (
            <BotaoExcluir
              excluir={{
                rotulo: 'Excluir imóvel',
                titulo: 'Excluir este imóvel?',
                descricao: `${editingProperty.nickname || editingProperty.name} sai do sistema. Esta ação não pode ser desfeita.`,
                aoConfirmar: () => excluirImovel(editingProperty.id),
              }}
            />
          ) : undefined
        }
      />
    </JanelaResponsiva>
  );

  const abas = (
    <AbasRolaveis
      rotulo="Propriedades"
      valor={aba}
      aoMudar={(v) => setAba(v === 'documentos' ? 'documentos' : 'imoveis')}
      itens={[
        { valor: 'imoveis', rotulo: 'Imóveis', icone: Building2, contagem: properties.length },
        { valor: 'documentos', rotulo: 'Documentos', icone: FolderOpen },
      ]}
    />
  );

  const documentos = (
    <DocumentosImoveis
      imoveis={properties}
      podeEditar={podeEditar}
      filtroImovel={filtroDocumentos}
      aoMudarFiltroImovel={setFiltroDocumentos}
    />
  );

  // Celular e tablet: desenho novo (T5); o computador continua como está
  if (compacto) {
    return (
      <div className="grid min-w-0 grid-cols-1 gap-3">
        {abas}
        {aba === 'documentos' ? documentos : (
          <PropriedadesCelular
            imoveis={properties}
            podeCriar={hasPermission('properties_create')}
            podeAbrir={(p) => podeEditar(p.id)}
            aoNova={() => janelaCadastro.abrir(null)}
            aoAbrir={handleEdit}
          />
        )}
        {janela}
      </div>
    );
  }

  if (aba === 'documentos') {
    return (
      <div className="space-y-6">
        {abas}
        {documentos}
        {janela}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {abas}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">Minhas Propriedades</h2>
          <p className="text-gray-600 mt-1">Gerencie suas propriedades de aluguel por temporada</p>
        </div>
        
        {hasPermission('properties_create') && (
          <Button onClick={() => janelaCadastro.abrir(null)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Propriedade
          </Button>
        )}
        {janela}
      </div>

      {properties.length === 0 ? (
        <Card className="bg-white">
          <CardContent className="p-12 text-center">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma propriedade cadastrada</h3>
            <p className="text-gray-500 mb-4">Comece adicionando sua primeira propriedade.</p>
            {hasPermission('properties_create') && (
              <Button 
                onClick={() => janelaCadastro.abrir(null)}
                className="bg-brand hover:bg-brand-hover text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Propriedade
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 sm:gap-6">
          {properties.map((property) => (
            <Card key={property.id} className="overflow-hidden bg-white transition-shadow hover:shadow-md">
              {/* Capa: o cadastro não tem foto; mostra o tipo do imóvel sobre o gradiente da marca */}
              <div className="relative flex h-24 items-end bg-gradient-primary p-4 text-white">
                <Home className="absolute right-4 top-4 h-10 w-10 opacity-25" aria-hidden="true" />
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm">
                  {property.property_type || 'Imóvel'}
                </span>
              </div>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="mb-1 text-lg text-ink">
                      {property.nickname || property.name}
                    </CardTitle>
                    {property.nickname && property.name !== property.nickname && (
                      <p className="mb-2 line-clamp-1 text-xs text-gray-500">{property.name}</p>
                    )}
                    <Badge className={getStatusColor(property.status)}>
                      {property.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {(canAccessProperty(property.id) === 'full' || 
                      (canAccessProperty(property.id) === 'read_only' && hasPermission('properties_edit'))) && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(property)}
                        aria-label="Editar propriedade"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {(canAccessProperty(property.id) === 'full' && hasPermission('properties_delete')) && (
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Excluir propriedade"
                        onClick={() => handleDelete(property.id)}
                        className="text-danger-600 hover:text-danger-700 hover:border-danger-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-600">
                    <MapPin className="h-4 w-4 mr-2" />
                    {property.address || 'Endereço não informado'}
                  </div>
                  
                  <div className="flex items-center text-gray-600">
                    <Users className="h-4 w-4 mr-2" />
                    {property.max_guests ? `Até ${property.max_guests} hóspedes` : 'Capacidade não informada'}
                  </div>
                  
                  {property.base_nightly_price && (
                    <div className="flex items-center text-gray-600">
                      <DollarSign className="h-4 w-4 mr-2" />
                      <span className="font-mono font-semibold tabular-nums text-success-700">
                        R$ {property.base_nightly_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / noite
                      </span>
                    </div>
                  )}
                </div>

                <Button variant="outline" size="sm" onClick={() => verDocumentos(property.id)} className="w-full gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Documentos
                </Button>

                {(property.airbnb_link || property.booking_link) && (
                  <div className="flex gap-2 pt-2 border-t">
                    {property.airbnb_link && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(property.airbnb_link, '_blank')}
                        className="flex-1"
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        Airbnb
                      </Button>
                    )}
                    {property.booking_link && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(property.booking_link, '_blank')}
                        className="flex-1"
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        Booking
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PropertiesList;
