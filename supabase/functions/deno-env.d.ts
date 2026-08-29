/**
 * Declarações mínimas do ambiente Deno, só para permitir que o `tsc` valide o
 * código destas funções fora do Deno.
 *
 * Não substitui o runtime: serve para pegar erros de compilação — variável usada
 * antes de existir, tipo incompatível, propriedade inexistente — antes do deploy.
 */

declare module 'https://deno.land/std@0.190.0/http/server.ts' {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module 'https://deno.land/std@0.190.0/testing/asserts.ts' {
  export function assertEquals(actual: unknown, expected: unknown, msg?: string): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2.50.3' {
  // deno-lint-ignore no-explicit-any
  export function createClient(url: string, key: string, options?: any): any;
}

declare const Deno: {
  env: { get(key: string): string | undefined };
  test(name: string, fn: () => void | Promise<void>): void;
};
