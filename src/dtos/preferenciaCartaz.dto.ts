import { z } from 'zod';
import { ChavePreferenciaCartaz } from '../models/PreferenciaCartaz';

/** Teto do JSON guardado por chave — preferências são só texto/números/cores; nada perto disso é legítimo. */
const TAMANHO_MAXIMO_BYTES = 32 * 1024;
/** O dicionário de descrições cresce com o catálogo (uma linha por produto editado) — ~3 mil produtos cabem aqui; o lote do Cartaz de oferta, idem. */
const TAMANHO_MAXIMO_LISTAS_BYTES = 512 * 1024;
const CHAVES_COM_LISTA = new Set([ChavePreferenciaCartaz.DESCRICOES_PRODUTO, ChavePreferenciaCartaz.CARTAZ_OFERTA]);

export const chavePreferenciaSchema = z.nativeEnum(ChavePreferenciaCartaz, {
  errorMap: () => ({ message: 'Preferência inválida.' }),
});

export function salvarPreferenciaSchema(chave: ChavePreferenciaCartaz) {
  const limite = CHAVES_COM_LISTA.has(chave) ? TAMANHO_MAXIMO_LISTAS_BYTES : TAMANHO_MAXIMO_BYTES;
  return z.object({
    valor: z
      .record(z.unknown())
      .refine((valor) => JSON.stringify(valor).length <= limite, { message: 'Preferências grandes demais.' }),
  });
}
export type SalvarPreferenciaDTO = z.infer<ReturnType<typeof salvarPreferenciaSchema>>;
