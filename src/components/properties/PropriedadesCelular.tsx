/**
 * Propriedades no celular (abaixo de 1024px), desenho `mProp` do plano (T5):
 * busca + "Nova" → uma linha de 76px por imóvel (ícone do tipo, apelido,
 * tipo · cidade, diária "por noite"). Tocar abre o imóvel para editar; excluir
 * fica dentro do imóvel, com confirmação (PropertiesList passa o botão ao
 * formulário).
 */
import React, { useMemo, useState } from 'react';
import { BedDouble, Building, Building2, Home, MapPin, Plus, type LucideIcon } from 'lucide-react';
import BarraBusca, { BotaoBarra } from '@/components/comum/BarraBusca';
import EstadoVazio from '@/components/comum/EstadoVazio';
import LinhaLista from '@/components/comum/LinhaLista';
import { ListaLinhas } from '@/components/comum/GrupoLista';
import { Etiqueta } from '@/components/comum/Etiquetas';
import { formatarMoedaSemCentavos } from '@/components/comum/formatos';
import type { Property } from '@/types/property';

/** Ícone conforme o tipo cadastrado (texto livre) */
function iconeDoTipo(tipo?: string | null): LucideIcon {
  const t = (tipo || '').toLowerCase();
  if (t.includes('casa') || t.includes('chalé') || t.includes('chale') || t.includes('sítio')) return Home;
  if (t.includes('cobertura')) return Building;
  if (t.includes('estúdio') || t.includes('studio') || t.includes('loft') || t.includes('kitnet') || t.includes('quarto') || t.includes('suíte')) return BedDouble;
  if (t.includes('apart') || t.includes('flat')) return Building2;
  return Home;
}

interface PropriedadesCelularProps {
  imoveis: Property[];
  podeCriar: boolean;
  /** Pode abrir para editar este imóvel? */
  podeAbrir: (imovel: Property) => boolean;
  aoNova: () => void;
  aoAbrir: (imovel: Property) => void;
}

const PropriedadesCelular = ({ imoveis, podeCriar, podeAbrir, aoNova, aoAbrir }: PropriedadesCelularProps) => {
  const [busca, setBusca] = useState('');

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return imoveis;
    return imoveis.filter((p) =>
      [p.nickname, p.name, p.city, p.address, p.property_type].some((c) => (c || '').toLowerCase().includes(termo)),
    );
  }, [busca, imoveis]);

  const algumAbre = imoveis.some(podeAbrir);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <BarraBusca valor={busca} aoMudar={setBusca} placeholder="Buscar imóvel">
        {podeCriar && <BotaoBarra icone={Plus} rotulo="Nova propriedade" texto="Nova" primario aoClicar={aoNova} />}
      </BarraBusca>

      {imoveis.length === 0 ? (
        <EstadoVazio icone={MapPin} titulo="Nenhuma propriedade cadastrada" descricao="Comece adicionando sua primeira propriedade." />
      ) : lista.length === 0 ? (
        <EstadoVazio icone={MapPin} titulo="Nenhum imóvel encontrado" descricao="Tente outro nome, cidade ou tipo." />
      ) : (
        <section className="rounded-2xl border bg-card px-3.5 py-1 shadow-sm" aria-label="Imóveis">
          <ListaLinhas>
            {lista.map((p) => {
              const local = p.city || p.address;
              return (
                <LinhaLista
                  key={p.id}
                  className="min-h-[76px]"
                  icone={iconeDoTipo(p.property_type)}
                  tomIcone="brand"
                  titulo={p.nickname || p.name}
                  subtitulo={[p.property_type || 'Imóvel', local].filter(Boolean).join(' · ')}
                  etiqueta={p.status && p.status !== 'Ativo' ? <Etiqueta tom="neutro">{p.status}</Etiqueta> : undefined}
                  valor={p.base_nightly_price ? formatarMoedaSemCentavos(p.base_nightly_price) : '—'}
                  legenda={p.base_nightly_price ? 'por noite' : 'sem diária'}
                  aoTocar={podeAbrir(p) ? () => aoAbrir(p) : undefined}
                />
              );
            })}
          </ListaLinhas>
        </section>
      )}

      {algumAbre && lista.length > 0 && (
        <p className="text-center text-xs text-gray-500">Toque num imóvel para abrir e editar. Excluir fica dentro do imóvel.</p>
      )}
    </div>
  );
};

export default PropriedadesCelular;
