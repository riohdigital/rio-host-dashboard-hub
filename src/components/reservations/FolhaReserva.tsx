/**
 * FolhaReserva — os detalhes e as ações de uma reserva (desenho
 * `mReservaFolha` do plano, decisão D5): situação da reserva, pagamento,
 * faxina da saída (atribuir/trocar), comunicado, recibo, editar e excluir.
 * Abaixo de 1024px sobe de baixo; no computador é uma janela (FolhaDetalhes).
 *
 * Pode ser aberta de qualquer tela. Com a reserva já carregada:
 *   <FolhaReserva aberta={!!sel} aoMudar={(v) => !v && setSel(null)} reserva={sel}
 *     aoAlterar={() => queryClient.invalidateQueries({ queryKey: ['reservations'] })} />
 *
 * Ou só com o id ou o código (a folha busca a reserva):
 *   <FolhaReserva aberta={aberta} aoMudar={setAberta} codigo="HM483391" />
 *
 * Toda mudança é gravada na hora e avisa `aoAlterar` (para a tela recarregar).
 * Editar abre o formulário da própria folha, a não ser que a tela passe
 * `aoEditar`. As ações respeitam as permissões de quem está logado.
 */
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, MessageCircle, Pencil, UserRound, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FolhaDetalhes from '@/components/comum/FolhaDetalhes';
import JanelaResponsiva from '@/components/comum/JanelaResponsiva';
import LinhaLista from '@/components/comum/LinhaLista';
import { ListaLinhas } from '@/components/comum/GrupoLista';
import { EtiquetaPlataforma, EtiquetaStatus } from '@/components/comum/Etiquetas';
import { formatarMoeda } from '@/components/comum/formatos';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useReservationStatusUpdate } from '@/hooks/useReservationStatusUpdate';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import type { Reservation } from '@/types/reservation';
import { cn } from '@/lib/utils';
import ReservationForm from './ReservationForm';
import Segmentado from './Segmentado';
import { comHora, dataCurta, noites, periodoCurto } from './datas';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';

/** A reserva como as telas a carregam: com o imóvel junto (select('*, properties(*)')) */
export type ReservaDaFolha = Reservation & {
  properties?: { id?: string; name?: string | null; nickname?: string | null } | null;
  cleaning_status?: string | null;
};

export interface FolhaReservaProps {
  aberta: boolean;
  aoMudar: (aberta: boolean) => void;
  /** A reserva já carregada. Se não vier, a folha busca por `id` ou `codigo` */
  reserva?: ReservaDaFolha | null;
  id?: string | null;
  codigo?: string | null;
  /** Nome da faxineira, quando a tela já sabe (evita uma consulta) */
  nomeFaxineira?: string | null;
  /** Depois de qualquer mudança gravada (status, faxina, comunicado, recibo, edição, exclusão) */
  aoAlterar?: () => void;
  /** Editar: a tela abre o formulário dela. Sem isto, a folha abre o próprio */
  aoEditar?: (reserva: ReservaDaFolha) => void;
}

const SITUACOES = [
  { valor: 'Confirmada', rotulo: 'Confirmada' },
  { valor: 'Em Andamento', rotulo: 'Em curso' },
  { valor: 'Finalizada', rotulo: 'Finalizada' },
  { valor: 'Cancelada', rotulo: 'Cancelada' },
];
const PAGAMENTOS = [
  { valor: 'Pago', rotulo: 'Pago' },
  { valor: 'Pendente', rotulo: 'A receber' },
  { valor: 'Atrasado', rotulo: 'Atrasado' },
];

interface Faxineira {
  user_id: string;
  full_name: string | null;
}

/** Busca a reserva pelo id ou pelo código, com o imóvel junto */
async function buscarReserva(id?: string | null, codigo?: string | null): Promise<ReservaDaFolha | null> {
  let consulta = supabase.from('reservations').select('*, properties(*)');
  consulta = id ? consulta.eq('id', id) : consulta.eq('reservation_code', codigo as string);
  const { data, error } = await consulta.limit(1).maybeSingle();
  if (error) throw error;
  return (data as unknown as ReservaDaFolha) ?? null;
}

const Campo = ({ rotulo, children }: { rotulo: React.ReactNode; children: React.ReactNode }) => (
  <div className="grid gap-1.5">
    <span className="text-xs text-gray-500">{rotulo}</span>
    {children}
  </div>
);

const FolhaReserva = ({ aberta, aoMudar, reserva, id, codigo, nomeFaxineira, aoAlterar, aoEditar }: FolhaReservaProps) => {
  const { toast } = useToast();
  const { hasPermission } = useUserPermissions();
  const { updateStatus } = useReservationStatusUpdate();

  const buscar = aberta && !reserva && Boolean(id || codigo);
  const { data: buscada, isLoading: buscando } = useQuery({
    queryKey: ['reserva-folha', id ?? null, codigo ?? null],
    queryFn: () => buscarReserva(id, codigo),
    enabled: buscar,
    staleTime: 30_000,
  });

  // Cópia local: as mudanças aparecem na hora, sem esperar a tela recarregar
  const origem = reserva ?? buscada ?? null;
  const [r, setR] = useState<ReservaDaFolha | null>(origem);
  useEffect(() => {
    // Fechada, guarda a última reserva (a folha ainda está descendo quando a lista recarrega)
    if (origem) setR(origem);
    else if (aberta) setR(null);
  }, [origem, aberta]);

  const [gravando, setGravando] = useState<{ campo: string; valor: string } | null>(null);
  // Voltam depois de recarregar a página, para a reserva que estava aberta
  const chaveDaFolha = `reservas.folha.${reserva?.id ?? id ?? codigo ?? 'sem-reserva'}`;
  const [escolhendoFaxineira, setEscolhendoFaxineira] = useEstadoPersistente<boolean>(`${chaveDaFolha}.escolhendoFaxineira`, false);
  const [editando, setEditando] = useEstadoPersistente<boolean>(`${chaveDaFolha}.editando`, false);
  useEffect(() => {
    if (!aberta) setEscolhendoFaxineira(false);
  }, [aberta, setEscolhendoFaxineira]);

  const podeEditar = hasPermission('reservations_edit');
  const podeExcluir = hasPermission('reservations_delete');
  const podeAtribuir = hasPermission('gestao_faxinas_assign');
  const podeTrocar = hasPermission('gestao_faxinas_reassign');

  const imovelId = r?.property_id || r?.properties?.id || null;
  const temFaxineira = Boolean(r?.cleaner_user_id);
  const faxinaFeita = (r?.cleaning_status || '').toLowerCase() === 'realizada';
  const podeMexerNaFaxina = !faxinaFeita && (temFaxineira ? podeTrocar : podeAtribuir);

  // Faxineiras do imóvel (para atribuir/trocar)
  const { data: faxineiras = [], isLoading: carregandoFaxineiras } = useQuery({
    queryKey: ['faxineiras-do-imovel', imovelId],
    queryFn: async (): Promise<Faxineira[]> => {
      const { data, error } = await supabase.rpc('fn_get_cleaners_for_properties' as never, { property_ids: [imovelId] } as never);
      if (error) throw error;
      return ((data as unknown as Faxineira[]) || []).filter((f) => f.user_id);
    },
    enabled: aberta && Boolean(imovelId) && podeMexerNaFaxina,
    staleTime: 5 * 60_000,
  });

  // Nome da faxineira atribuída, quando a tela não mandou
  const { data: nomeBuscado } = useQuery({
    queryKey: ['nome-faxineira', r?.cleaner_user_id ?? null],
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('full_name').eq('user_id', r?.cleaner_user_id as string).maybeSingle();
      return (data?.full_name as string | null) ?? null;
    },
    enabled: aberta && temFaxineira && !nomeFaxineira,
    staleTime: 5 * 60_000,
  });

  const nomeDaFaxineira = temFaxineira
    ? faxineiras.find((f) => f.user_id === r?.cleaner_user_id)?.full_name || nomeFaxineira || nomeBuscado || 'Faxineira atribuída'
    : 'Sem faxineira';

  const avisar = () => aoAlterar?.();

  const mudarStatus = async (campo: 'reservation_status' | 'payment_status', valor: string) => {
    if (!r) return;
    setGravando({ campo, valor });
    const ok = await updateStatus({ reservationId: r.id, statusType: campo, newStatus: valor, onUpdate: avisar });
    if (ok) setR((atual) => (atual ? { ...atual, [campo]: valor } : atual));
    setGravando(null);
  };

  const alternar = async (campo: 'is_communicated' | 'receipt_sent') => {
    if (!r) return;
    const valor = !r[campo];
    setR((atual) => (atual ? { ...atual, [campo]: valor } : atual));
    const { error } = await supabase.from('reservations').update({ [campo]: valor }).eq('id', r.id);
    if (error) {
      setR((atual) => (atual ? { ...atual, [campo]: !valor } : atual));
      toast({ title: 'Erro', description: 'Falha ao atualizar.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Sucesso', description: `${campo === 'is_communicated' ? 'Comunicado' : 'Recibo'} ${valor ? 'marcado' : 'desmarcado'}.` });
    avisar();
  };

  const escolherFaxineira = async (faxineira: Faxineira) => {
    if (!r) return;
    setGravando({ campo: 'faxina', valor: faxineira.user_id });
    const { error } = temFaxineira
      ? await supabase.rpc('reassign_cleaning_with_permissions' as never, { reservation_id: r.id, new_cleaner_id: faxineira.user_id } as never)
      : await supabase.rpc('assign_cleaning_with_permissions' as never, { reservation_id: r.id, cleaner_id: faxineira.user_id } as never);
    setGravando(null);
    if (error) {
      toast({ title: 'Erro', description: error.message || 'Não foi possível atribuir a faxina.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Sucesso!', description: temFaxineira ? 'Faxina reatribuída.' : 'Faxina atribuída.' });
    setR((atual) => (atual ? { ...atual, cleaner_user_id: faxineira.user_id } : atual));
    setEscolhendoFaxineira(false);
    avisar();
  };

  const excluir = async () => {
    if (!r) return;
    const { error } = await supabase.from('reservations').delete().eq('id', r.id);
    if (error) {
      toast({ title: 'Erro', description: error.message || 'Não foi possível excluir a reserva.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Sucesso', description: 'Reserva excluída com sucesso.' });
    aoMudar(false);
    avisar();
  };

  const editar = () => {
    if (!r) return;
    if (aoEditar) {
      aoMudar(false);
      aoEditar(r);
    } else {
      setEditando(true);
    }
  };

  const imovel = r?.properties?.nickname || r?.properties?.name || 'Imóvel';
  const n = noites(r?.check_in_date, r?.check_out_date);
  const pago = (r?.payment_status || '').toLowerCase() === 'pago';
  const telefone = r?.guest_phone?.replace(/\D/g, '');

  const acoes = r && podeEditar && (
    <>
      <Button
        type="button"
        variant="outline"
        aria-pressed={!!r.is_communicated}
        onClick={() => alternar('is_communicated')}
        className={cn('gap-1.5 rounded-full', r.is_communicated && 'border-success-300 bg-success-50 text-success-700 hover:bg-success-100')}
      >
        {r.is_communicated && <Check className="h-4 w-4" aria-hidden="true" />}
        Comunicado
      </Button>
      <Button
        type="button"
        variant="outline"
        aria-pressed={!!r.receipt_sent}
        onClick={() => alternar('receipt_sent')}
        className={cn('gap-1.5 rounded-full', r.receipt_sent && 'border-success-300 bg-success-50 text-success-700 hover:bg-success-100')}
      >
        {r.receipt_sent && <Check className="h-4 w-4" aria-hidden="true" />}
        Recibo
      </Button>
      <Button type="button" variant="outline" onClick={editar} className="gap-1.5 rounded-full">
        <Pencil className="h-4 w-4" aria-hidden="true" />
        Editar
      </Button>
    </>
  );

  return (
    <>
      <FolhaDetalhes
        aberta={aberta}
        aoMudar={aoMudar}
        titulo={r ? r.guest_name || 'Hóspede sem nome' : buscando ? 'Carregando…' : 'Reserva não encontrada'}
        etiqueta={r ? <EtiquetaPlataforma plataforma={r.platform} /> : undefined}
        subtitulo={
          r ? (
            <>
              {imovel} · {periodoCurto(r.check_in_date, r.check_out_date)} · {n} {n === 1 ? 'noite' : 'noites'} ·{' '}
              <span className="font-mono">{r.reservation_code}</span>
            </>
          ) : undefined
        }
        acoes={acoes || undefined}
        excluir={
          r && podeExcluir
            ? {
                rotulo: 'Excluir reserva',
                titulo: 'Excluir esta reserva?',
                descricao: 'A reserva sai do sistema e esta ação não pode ser desfeita.',
                aoConfirmar: excluir,
              }
            : undefined
        }
      >
        {!r ? (
          <div className="grid place-items-center py-8 text-sm text-gray-500">
            {buscando ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Carregando" /> : 'Não encontramos esta reserva.'}
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              {[
                { rotulo: 'Total', valor: formatarMoeda(r.total_revenue) },
                { rotulo: 'Comissão', valor: formatarMoeda(r.commission_amount) },
                { rotulo: 'Líquido', valor: formatarMoeda(r.net_revenue), classe: 'text-success-700' },
                { rotulo: pago ? 'Recebido em' : 'Recebe em', valor: r.payment_date ? dataCurta(r.payment_date) : '—' },
              ].map((kv) => (
                <div key={kv.rotulo} className="min-w-0">
                  <dt className="truncate text-xs text-gray-500">{kv.rotulo}</dt>
                  <dd className={cn('truncate font-mono text-sm font-semibold tabular-nums text-gray-900', kv.classe)}>{kv.valor}</dd>
                </div>
              ))}
            </dl>

            <Campo rotulo="Situação da reserva">
              {podeEditar ? (
                <Segmentado
                  rotulo="Situação da reserva"
                  opcoes={SITUACOES}
                  valor={r.reservation_status}
                  aoMudar={(v) => mudarStatus('reservation_status', v)}
                  gravando={gravando?.campo === 'reservation_status' ? gravando.valor : null}
                />
              ) : (
                <div><EtiquetaStatus status={r.reservation_status} /></div>
              )}
            </Campo>

            <Campo rotulo="Pagamento">
              {podeEditar ? (
                <Segmentado
                  rotulo="Pagamento"
                  opcoes={PAGAMENTOS}
                  valor={r.payment_status || 'Pendente'}
                  aoMudar={(v) => mudarStatus('payment_status', v)}
                  gravando={gravando?.campo === 'payment_status' ? gravando.valor : null}
                />
              ) : (
                <div><EtiquetaStatus status={r.payment_status || 'Pendente'} /></div>
              )}
            </Campo>

            <Campo rotulo="Faxina da saída">
              <div className="rounded-2xl border px-3.5">
                <LinhaLista
                  icone={UserRound}
                  tomIcone={temFaxineira ? 'brand' : faxinaFeita ? 'neutro' : 'danger'}
                  titulo={nomeDaFaxineira}
                  subtitulo={`Saída ${dataCurta(r.check_out_date)}${comHora(r.checkout_time)}${r.cleaning_status ? ` · ${r.cleaning_status}` : ''}`}
                  acao={
                    podeMexerNaFaxina ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={temFaxineira || escolhendoFaxineira ? 'outline' : 'default'}
                        aria-expanded={escolhendoFaxineira}
                        onClick={() => setEscolhendoFaxineira((v) => !v)}
                        className="min-h-9 rounded-full"
                      >
                        {escolhendoFaxineira ? 'Fechar' : temFaxineira ? 'Trocar' : 'Atribuir'}
                      </Button>
                    ) : undefined
                  }
                />
                {escolhendoFaxineira && (
                  <div className="border-t border-gray-100 py-1">
                    {carregandoFaxineiras ? (
                      <div className="grid place-items-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-label="Carregando faxineiras" /></div>
                    ) : faxineiras.length === 0 ? (
                      <p className="py-3 text-sm text-gray-500">Nenhuma faxineira ligada a este imóvel. Cadastre em Configurações.</p>
                    ) : (
                      <ListaLinhas>
                        {faxineiras.map((f) => {
                          const atual = f.user_id === r.cleaner_user_id;
                          return (
                            <button
                              key={f.user_id}
                              type="button"
                              disabled={atual || !!gravando}
                              onClick={() => escolherFaxineira(f)}
                              className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-medium text-gray-900 disabled:text-gray-400"
                            >
                              <span className="truncate">{f.full_name || 'Sem nome'}</span>
                              {atual ? (
                                <span className="text-xs">atual</span>
                              ) : gravando?.valor === f.user_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : null}
                            </button>
                          );
                        })}
                      </ListaLinhas>
                    )}
                  </div>
                )}
              </div>
            </Campo>

            {(telefone || r.number_of_guests) && (
              <div className="flex min-h-11 items-center justify-between gap-3 text-sm text-gray-600">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  {r.number_of_guests ? `${r.number_of_guests} ${r.number_of_guests === 1 ? 'hóspede' : 'hóspedes'}` : 'Hóspedes não informados'}
                </span>
                {telefone && (
                  <Button asChild variant="ghost" size="sm" className="min-h-11 gap-1.5 text-success-700 hover:text-success-700">
                    <a href={`https://wa.me/55${telefone}`} target="_blank" rel="noreferrer">
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </FolhaDetalhes>

      {!aoEditar && (
        <JanelaResponsiva
          aberta={editando}
          aoMudar={(v) => !v && setEditando(false)}
          titulo="Editar Reserva"
          telaCheia
          largura="xl"
        >
          {editando && r && (
            <ReservationForm
              reservation={r}
              onSuccess={() => {
                setEditando(false);
                aoMudar(false);
                avisar();
              }}
              onCancel={() => setEditando(false)}
            />
          )}
        </JanelaResponsiva>
      )}
    </>
  );
};

export default FolhaReserva;
