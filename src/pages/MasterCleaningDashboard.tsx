import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Filter, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMasterCleaningData } from '@/hooks/useMasterCleaningData';
import CleanerSelector from '@/components/master-cleaning/CleanerSelector';
import MasterCleaningCard from '@/components/master-cleaning/MasterCleaningCard';
import CleaningStats from '@/components/master-cleaning/CleaningStats';
import type { ReservationWithCleanerInfo } from '@/types/master-cleaning';

const MasterCleaningDashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { allCleanings, availableCleanings, cleaners, isLoading, refetch } = useMasterCleaningData();
  
  const [selectedCleaner, setSelectedCleaner] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Mutações para reassignação e remoção
  const reassignMutation = useMutation({
    mutationFn: async ({ reservationId, cleanerId }: { reservationId: string; cleanerId: string }) => {
      const { error } = await supabase.rpc('master_reassign_cleaning' as any, {
        reservation_id: reservationId,
        new_cleaner_id: cleanerId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Sucesso!", description: "Faxina reassignada com sucesso." });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao reassignar faxina",
        variant: "destructive"
      });
    }
  });

  const unassignMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      const { error } = await supabase.rpc('master_unassign_cleaning' as any, {
        reservation_id: reservationId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Sucesso!", description: "Faxineira removida da faxina." });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover faxineira",
        variant: "destructive"
      });
    }
  });

  // Filtros
  const filteredCleanings = useMemo(() => {
    let filtered = allCleanings;

    // Filtro por faxineira
    if (selectedCleaner) {
      filtered = filtered.filter(cleaning => cleaning.cleaner_user_id === selectedCleaner);
    }

    // Filtro por busca
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(cleaning => 
        cleaning.properties?.name.toLowerCase().includes(searchLower) ||
        cleaning.reservation_code.toLowerCase().includes(searchLower) ||
        cleaning.guest_name?.toLowerCase().includes(searchLower) ||
        cleaning.cleaner_info?.full_name.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [allCleanings, selectedCleaner, searchTerm]);

  const assignedCleanings = useMemo(() => 
    filteredCleanings.filter(c => c.cleaner_user_id), 
    [filteredCleanings]
  );

  const pendingCleanings = useMemo(() => 
    assignedCleanings.filter(c => c.cleaning_status === 'Pendente'), 
    [assignedCleanings]
  );

  const completedCleanings = useMemo(() => 
    assignedCleanings.filter(c => c.cleaning_status === 'Realizada'), 
    [assignedCleanings]
  );

  const filteredAvailableCleanings = useMemo(() => {
    if (!searchTerm) return availableCleanings;
    
    const searchLower = searchTerm.toLowerCase();
    return availableCleanings.filter(cleaning => 
      cleaning.properties?.name.toLowerCase().includes(searchLower) ||
      cleaning.reservation_code.toLowerCase().includes(searchLower) ||
      cleaning.guest_name?.toLowerCase().includes(searchLower)
    );
  }, [availableCleanings, searchTerm]);

  const handleReassign = (reservationId: string, cleanerId: string) => {
    reassignMutation.mutate({ reservationId, cleanerId });
  };

  const handleUnassign = (reservationId: string) => {
    unassignMutation.mutate(reservationId);
  };

  const renderCleaningGrid = (cleanings: ReservationWithCleanerInfo[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cleanings.map((cleaning) => (
        <MasterCleaningCard
          key={cleaning.id}
          reservation={cleaning}
          cleaners={cleaners}
          onReassign={handleReassign}
          onUnassign={handleUnassign}
          isLoading={reassignMutation.isPending || unassignMutation.isPending}
        />
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Faxinas</h1>
          <p className="text-muted-foreground">Controle centralizado de todas as faxinas</p>
        </div>
        
        <Button onClick={refetch} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <CleanerSelector
              cleaners={cleaners}
              selectedCleaner={selectedCleaner}
              onCleanerChange={setSelectedCleaner}
            />
            
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por propriedade, código, hóspede ou faxineira..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all" className="flex items-center gap-2">
            Todas
            <Badge variant="outline">{filteredCleanings.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            Pendentes
            <Badge variant="outline">{pendingCleanings.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            Concluídas
            <Badge variant="outline">{completedCleanings.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="available" className="flex items-center gap-2">
            Disponíveis
            <Badge variant="outline">{filteredAvailableCleanings.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="stats">
            Estatísticas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-foreground">Todas as Faxinas</h2>
            <p className="text-sm text-muted-foreground">
              {filteredCleanings.length} faxina(s) encontrada(s)
            </p>
          </div>
          {filteredCleanings.length > 0 ? (
            renderCleaningGrid(filteredCleanings)
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma faxina encontrada
            </p>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-foreground">Faxinas Pendentes</h2>
            <p className="text-sm text-muted-foreground">
              {pendingCleanings.length} faxina(s) pendente(s)
            </p>
          </div>
          {pendingCleanings.length > 0 ? (
            renderCleaningGrid(pendingCleanings)
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma faxina pendente
            </p>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-foreground">Faxinas Concluídas</h2>
            <p className="text-sm text-muted-foreground">
              {completedCleanings.length} faxina(s) concluída(s)
            </p>
          </div>
          {completedCleanings.length > 0 ? (
            renderCleaningGrid(completedCleanings)
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma faxina concluída
            </p>
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-foreground">Faxinas Disponíveis</h2>
            <p className="text-sm text-muted-foreground">
              {filteredAvailableCleanings.length} oportunidade(s) disponível(is)
            </p>
          </div>
          {filteredAvailableCleanings.length > 0 ? (
            renderCleaningGrid(filteredAvailableCleanings)
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma faxina disponível
            </p>
          )}
        </TabsContent>

        <TabsContent value="stats">
          <CleaningStats
            allCleanings={allCleanings}
            availableCleanings={availableCleanings}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MasterCleaningDashboard;