import { useCallback, useEffect, useMemo, useRef } from 'react';
import { apagarEscolhas, gravarEscolha, lerEscolha, useDonoDasEscolhas } from '@/hooks/useEstadoPersistente';

/**
 * Rascunhos de formulário: o que foi digitado volta depois de recarregar a
 * página. Duas peças:
 *
 * `useRascunho(chave)` — para formulários feitos com estados. Os campos usam
 * `useEstadoPersistente(rascunho.de('campo'), …)` e o rascunho cuida do ciclo
 * de vida:
 *
 *   const rascunho = useRascunho(`imoveis.form.${imovel?.id ?? 'novo'}`, { edicao: !!imovel });
 *   const [dados, setDados] = useEstadoPersistente(rascunho.de('dados'), VAZIO);
 *   useEffect(() => { if (imovel && !rascunho.tem('dados')) setDados(doImovel(imovel)); }, [imovel]);
 *   ...ao salvar ou cancelar: rascunho.limpar();
 *
 * `useRascunhoFormulario({ chave, valores, setValue })` — para formulários do
 * react-hook-form: grava `watch()` e devolve `restaurar()`.
 *
 * Regras, nas duas:
 * - Guardado na sessão, com o id do usuário na chave.
 * - Cadastro novo: o rascunho fica até salvar ou cancelar (fechar a janela
 *   sem querer não perde o que foi digitado).
 * - Edição (`edicao: true`): o rascunho vive só enquanto o formulário está
 *   aberto. Recarregar a página com ele aberto preserva; fechar descarta, para
 *   uma mudança não salva nunca reaparecer mais tarde por cima do registro.
 * - Senhas e segredos nunca são gravados (ver PARECE_SEGREDO e `fora`).
 */

const PARECE_SEGREDO = /senha|password|passwd|secret|segredo|token|api_?key|credential|credencia|cookie|otp/i;
const ESPERA_MS = 250;
/** Depois de limpar, quanto esperar um formulário que não fecha antes de zerar os campos na tela */
const ZERAR_APOS_MS = 800;

type Valores = Record<string, unknown>;

interface OpcoesRascunho {
  /** Editando um registro existente: descarta o rascunho quando o formulário fecha. */
  edicao?: boolean;
}

export function useRascunho(chave: string, { edicao = false }: OpcoesRascunho = {}) {
  const dono = useDonoDasEscolhas();
  const alvo = useRef({ dono, chave, edicao });
  alvo.current = { dono, chave, edicao };
  const limpo = useRef(false);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (relogio.current) clearTimeout(relogio.current);
      // Fechou: some o que foi limpo de propósito e, na edição, o que sobrou
      if (limpo.current || alvo.current.edicao) apagarEscolhas(alvo.current.dono, `${alvo.current.chave}.`);
    },
    [],
  );

  /** Chave de um campo ou estado auxiliar do formulário. */
  const de = useCallback((campo: string) => `${chave}.${campo}`, [chave]);
  /** Já existe algo guardado para este campo? (para não carregar o registro por cima) */
  const tem = useCallback((campo: string) => lerEscolha(alvo.current.dono, `${alvo.current.chave}.${campo}`) !== undefined, []);
  /**
   * Salvou ou cancelou de propósito. Sai do storage na hora; os campos na tela
   * só zeram quando o formulário fecha (ou logo depois, se ele não fechar),
   * para a janela não piscar vazia enquanto some.
   */
  const limpar = useCallback(() => {
    limpo.current = true;
    apagarEscolhas(alvo.current.dono, `${alvo.current.chave}.`, true);
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = setTimeout(() => {
      limpo.current = false;
      apagarEscolhas(alvo.current.dono, `${alvo.current.chave}.`);
    }, ZERAR_APOS_MS);
  }, []);

  return { chave, de, tem, limpar };
}

const paraGuardar = (valores: Valores, fora: ReadonlySet<string>) => {
  const limpo: Valores = {};
  for (const [campo, valor] of Object.entries(valores)) {
    if (fora.has(campo) || PARECE_SEGREDO.test(campo)) continue;
    if (valor === undefined || typeof valor === 'function') continue;
    if (typeof Blob !== 'undefined' && valor instanceof Blob) continue;
    if (valor instanceof Date) {
      if (!Number.isNaN(valor.getTime())) limpo[campo] = { __data: valor.toISOString() };
      continue;
    }
    if (typeof valor === 'number' && !Number.isFinite(valor)) continue;
    limpo[campo] = valor;
  }
  return limpo;
};

const aoLer = (valor: unknown): unknown => {
  if (valor && typeof valor === 'object' && '__data' in (valor as Valores)) {
    const data = new Date(String((valor as Valores).__data));
    return Number.isNaN(data.getTime()) ? undefined : data;
  }
  return valor;
};

interface OpcoesFormulario<T extends Valores> extends OpcoesRascunho {
  /** Chave do rascunho (inclua o id do registro em edição). */
  chave: string;
  /** Valores atuais do formulário (`watch()`). */
  valores: T;
  /** `setValue` do react-hook-form. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- aceita o setValue de qualquer formulário
  setValue: (campo: any, valor: any, opcoes?: any) => void;
  /** Campos que não entram no rascunho. */
  fora?: readonly string[];
}

const CAMPO_DOS_VALORES = 'campos';

export function useRascunhoFormulario<T extends Valores>({ chave, valores, setValue, fora, edicao }: OpcoesFormulario<T>) {
  const dono = useDonoDasEscolhas();
  const base = useRascunho(chave, { edicao });
  const foraSet = useMemo(() => new Set(fora ?? []), [fora]);
  const edicaoRef = useRef(edicao);
  edicaoRef.current = edicao;
  const gravando = useRef(false);
  const ultimoTexto = useRef<string | null>(null);
  const pendente = useRef<{ texto: string; valor: Valores } | null>(null);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alvo = useRef({ dono, chave: base.de(CAMPO_DOS_VALORES) });
  alvo.current = { dono, chave: base.de(CAMPO_DOS_VALORES) };

  const descarregar = useCallback(() => {
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = null;
    const p = pendente.current;
    pendente.current = null;
    if (!p || !gravando.current) return;
    ultimoTexto.current = p.texto;
    gravarEscolha(alvo.current.dono, alvo.current.chave, p.valor);
  }, []);

  // Grava com um pequeno atraso a cada mudança
  useEffect(() => {
    if (!gravando.current) return;
    const valor = paraGuardar(valores, foraSet);
    const texto = JSON.stringify(valor);
    if (texto === ultimoTexto.current) return;
    pendente.current = { texto, valor };
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = setTimeout(descarregar, ESPERA_MS);
  });

  // Recarregar a página logo depois de digitar não perde a última tecla
  useEffect(() => {
    window.addEventListener('pagehide', descarregar);
    window.addEventListener('beforeunload', descarregar);
    return () => {
      window.removeEventListener('pagehide', descarregar);
      window.removeEventListener('beforeunload', descarregar);
      // Fechou o formulário: grava o que ainda esperava (na edição o rascunho é descartado)
      if (!edicaoRef.current) descarregar();
    };
  }, [descarregar]);

  const limparBase = base.limpar;
  const limpar = useCallback(() => {
    gravando.current = false;
    pendente.current = null;
    ultimoTexto.current = null;
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = null;
    limparBase();
  }, [limparBase]);

  /** Aplica o rascunho guardado (se houver) e liga a gravação. Devolve se havia rascunho. */
  const restaurar = useCallback(() => {
    gravando.current = true;
    const guardado = lerEscolha(alvo.current.dono, alvo.current.chave);
    if (!guardado || typeof guardado !== 'object' || Array.isArray(guardado)) return false;
    for (const [campo, bruto] of Object.entries(guardado as Valores)) {
      if (foraSet.has(campo) || PARECE_SEGREDO.test(campo)) continue;
      const valor = aoLer(bruto);
      if (valor !== undefined) setValue(campo, valor, { shouldDirty: true });
    }
    return true;
  }, [setValue, foraSet]);

  return { restaurar, limpar, de: base.de, tem: base.tem, chave };
}

interface OpcoesJanela<T extends Valores> {
  /** Chave do rascunho (inclua o id do registro). `null` enquanto não há o que guardar. */
  chave: string | null;
  /** A janela está aberta. */
  aberta: boolean;
  /** Os valores atuais dos campos. */
  valores: T;
  /** Põe um rascunho guardado de volta nos campos. */
  aplicar: (rascunho: Partial<T>) => void;
  /** Os dados do registro já chegaram (padrão: sim). O rascunho só entra depois. */
  pronto?: boolean;
  /** Reaplica o rascunho quando isto muda (o que faz a janela recarregar o registro). */
  depende?: readonly unknown[];
  /** Campos que não entram no rascunho. */
  fora?: readonly string[];
}

/**
 * Rascunho para janelas que ficam sempre montadas e carregam o registro num
 * efeito ao abrir (o padrão `useEffect(() => { if (open) setCampos(registro) }, [open, registro])`).
 * Chame este hook DEPOIS desse efeito: ele repõe o que estava digitado por
 * cima do registro, grava a cada mudança e descarta o rascunho quando a
 * janela fecha. Recarregar a página com a janela aberta preserva o digitado.
 */
export function useRascunhoDeJanela<T extends Valores>({ chave, aberta, valores, aplicar, pronto = true, depende = [], fora }: OpcoesJanela<T>) {
  const dono = useDonoDasEscolhas();
  const foraSet = useMemo(() => new Set(fora ?? []), [fora]);
  const aplicarRef = useRef(aplicar);
  aplicarRef.current = aplicar;
  const gravando = useRef<string | null>(null);
  const ultimoTexto = useRef<string | null>(null);
  const campo = chave === null ? null : `${chave}.${CAMPO_DOS_VALORES}`;

  // Abriu (ou o registro recarregou): repõe o rascunho e liga a gravação
  useEffect(() => {
    if (!aberta || !pronto || campo === null) {
      gravando.current = null;
      return;
    }
    const guardado = lerEscolha(dono, campo);
    if (guardado && typeof guardado === 'object' && !Array.isArray(guardado)) {
      const limpo: Valores = {};
      for (const [nome, bruto] of Object.entries(guardado as Valores)) {
        if (foraSet.has(nome) || PARECE_SEGREDO.test(nome)) continue;
        const valor = aoLer(bruto);
        if (valor !== undefined) limpo[nome] = valor;
      }
      aplicarRef.current(limpo as Partial<T>);
    }
    gravando.current = campo;
    ultimoTexto.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `depende` vem de quem chama
  }, [aberta, pronto, campo, dono, foraSet, ...depende]);

  // Grava a cada mudança
  useEffect(() => {
    if (gravando.current === null || gravando.current !== campo) return;
    const valor = paraGuardar(valores, foraSet);
    const texto = JSON.stringify(valor);
    if (texto === ultimoTexto.current) return;
    ultimoTexto.current = texto;
    gravarEscolha(dono, campo, valor);
  });

  // Fechou a janela: o rascunho (e o que estiver guardado sob a chave) é descartado
  const anterior = useRef<{ aberta: boolean; chave: string | null }>({ aberta, chave });
  useEffect(() => {
    const antes = anterior.current;
    anterior.current = { aberta, chave };
    if (antes.aberta && !aberta && antes.chave !== null) apagarEscolhas(dono, `${antes.chave}.`);
  }, [aberta, chave, dono]);
}
