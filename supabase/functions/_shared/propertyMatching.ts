/**
 * Identificação da propriedade a partir do que a plataforma informa.
 *
 * Vale tanto para e-mails quanto para extratos importados: em ambos os casos a
 * plataforma diz o nome do anúncio (que muda quando você renomeia) e, no
 * Booking.com, o identificador da acomodação (que não muda).
 */

// deno-lint-ignore-file no-explicit-any
import { normalizeForMatch, semelhancaDeTitulos } from './textUtils.ts';

/** Quantos nomes de anúncio guardar por fonte, para não crescer sem limite. */
export const MAX_APELIDOS = 6;

/** Prefixo das linhas que guardam um identificador, e não um nome. */
export const MARCADOR_HOTEL_ID = 'booking_hotel_id:';

/**
 * Semelhança mínima para aceitar um anúncio renomeado, e vantagem mínima sobre
 * a segunda propriedade mais parecida.
 *
 * Calibrado com títulos reais: renomeações ficam entre 0,80 e 0,91; anúncios de
 * bairros diferentes que compartilham palavras genéricas ("Studio Copacabana
 * Praia" x "Studio Ipanema Praia") ficam em 0,50. Errar aqui joga a reserva no
 * imóvel errado, o que é pior que deixá-la para conferência.
 */
export const SEMELHANCA_MINIMA = 0.6;
export const MARGEM_MINIMA = 0.15;

export interface PropertyRow {
  id: string;
  name: string;
  nickname: string | null;
}

export interface SourceRow {
  property_id: string;
  platform: string;
  listing_alias: string | null;
}

export interface PropertyMatch {
  propertyId: string | null;
  how: string;
}

/** O campo aceita vários nomes, um por linha (ou separados por | ou ;). */
export function splitAliases(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[\n|;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
}

/** Só as linhas que são nome de anúncio. */
export function aliasNomes(value: string | null | undefined): string[] {
  return splitAliases(value).filter((item) => !item.startsWith(MARCADOR_HOTEL_ID));
}

/** Só os identificadores de acomodação do Booking.com. */
export function aliasHotelIds(value: string | null | undefined): string[] {
  return splitAliases(value)
    .filter((item) => item.startsWith(MARCADOR_HOTEL_ID))
    .map((item) => item.slice(MARCADOR_HOTEL_ID.length).trim())
    .filter(Boolean);
}

export interface PropertyLookup {
  platform: string | null;
  /** Nome do anúncio como a plataforma o chama. */
  listingName?: string | null;
  /** Identificador da acomodação no Booking.com. */
  hotelId?: string | null;
  /** Texto onde procurar menções ao anúncio (assunto e corpo do e-mail). */
  haystack?: string;
  properties: PropertyRow[];
  sources: SourceRow[];
}

/**
 * Da pista mais forte para a mais fraca: identificador da acomodação, apelido
 * conhecido, nome da propriedade citado, semelhança de título e, por fim, a
 * conta de um imóvel só.
 */
export function resolveProperty(lookup: PropertyLookup): PropertyMatch {
  const { platform, properties, sources } = lookup;
  const listing = lookup.listingName ? normalizeForMatch(lookup.listingName) : null;
  const haystack = normalizeForMatch(`${lookup.haystack ?? ''}\n${lookup.listingName ?? ''}`);

  const platformSources = sources.filter((source) => !platform || source.platform === platform);

  // 1) identificador da acomodação: não muda quando o anúncio é renomeado
  if (lookup.hotelId) {
    const porId = platformSources.find((source) =>
      aliasHotelIds(source.listing_alias).includes(lookup.hotelId!));
    if (porId) return { propertyId: porId.property_id, how: 'booking_hotel_id' };
  }

  // 2) apelido do anúncio configurado ou já aprendido
  const byAlias = platformSources
    .flatMap((source) => aliasNomes(source.listing_alias)
      .map((alias) => ({ source, alias: normalizeForMatch(alias) })))
    .filter(({ alias }) => alias.length >= 3
      && (haystack.includes(alias) || (listing && listing.includes(alias))))
    .sort((a, b) => b.alias.length - a.alias.length);

  if (byAlias.length > 0) {
    return { propertyId: byAlias[0].source.property_id, how: 'listing_alias' };
  }

  // 3) nome ou apelido da propriedade citado
  const byName = properties
    .flatMap((property) => [property.name, property.nickname]
      .filter((value): value is string => !!value && value.trim().length >= 4)
      .map((value) => ({ property, term: normalizeForMatch(value) })))
    .filter(({ term }) => haystack.includes(term) || (listing && listing.includes(term)))
    .sort((a, b) => b.term.length - a.term.length);

  if (byName.length > 0) {
    return { propertyId: byName[0].property.id, how: 'property_name' };
  }

  // 4) o anúncio foi renomeado: reconhece pelo grau de semelhança
  if (lookup.listingName) {
    const titulo = lookup.listingName;

    const pontuados = platformSources
      .flatMap((source) => aliasNomes(source.listing_alias).map((alias) => ({
        propertyId: source.property_id,
        score: semelhancaDeTitulos(titulo, alias),
      })))
      .concat(properties.flatMap((property) => [property.name, property.nickname]
        .filter((valor): valor is string => !!valor)
        .map((valor) => ({
          propertyId: property.id,
          score: semelhancaDeTitulos(titulo, valor),
        }))))
      .sort((a, b) => b.score - a.score);

    const melhor = pontuados[0];
    const rival = pontuados.find((item) => item.propertyId !== melhor?.propertyId);

    // Exige tanto semelhança alta quanto distância da segunda colocada: dois
    // anúncios parecidos em propriedades diferentes viram conferência.
    if (melhor
      && melhor.score >= SEMELHANCA_MINIMA
      && (!rival || melhor.score - rival.score >= MARGEM_MINIMA)) {
      return {
        propertyId: melhor.propertyId,
        how: `similaridade_${melhor.score.toFixed(2)}`,
      };
    }
  }

  // 5) conta com um imóvel só: não há ambiguidade possível
  if (properties.length === 1) {
    return { propertyId: properties[0].id, how: 'single_property' };
  }

  return { propertyId: null, how: 'unmatched' };
}

/**
 * Guarda na fonte o que a plataforma ensinou sobre a propriedade: o nome do
 * anúncio e, no Booking.com, o identificador da acomodação.
 *
 * É o que faz o sistema ficar mais preciso sozinho, sem ninguém preencher
 * configuração.
 */
export async function learnSourceHints(
  admin: any,
  propertyId: string,
  platform: string,
  hints: { listingName?: string | null; hotelId?: string | null },
): Promise<void> {
  const { data, error: readError } = await admin
    .from('channel_sync_sources')
    .select('id, listing_alias')
    .eq('property_id', propertyId)
    .eq('platform', platform)
    .limit(1);

  if (readError || !data?.length) return;

  const fonte = data[0];
  const linhas = splitAliases(fonte.listing_alias);
  const novas: string[] = [];

  const nome = hints.listingName?.trim();
  if (nome && nome.length >= 5 && aliasNomes(fonte.listing_alias).length < MAX_APELIDOS) {
    const normalizado = normalizeForMatch(nome);
    const conhecido = aliasNomes(fonte.listing_alias)
      .some((alias) => normalizeForMatch(alias) === normalizado);
    if (!conhecido) novas.push(nome);
  }

  const hotelId = hints.hotelId;
  if (hotelId && !aliasHotelIds(fonte.listing_alias).includes(hotelId)) {
    novas.push(`${MARCADOR_HOTEL_ID}${hotelId}`);
  }

  if (novas.length === 0) return;

  const { error } = await admin
    .from('channel_sync_sources')
    .update({ listing_alias: [...linhas, ...novas].join('\n') })
    .eq('id', fonte.id);

  if (error) console.error('Não foi possível guardar os dados do anúncio:', error.message);
}
