import { z } from 'zod';
import { ChavePreferenciaCartaz } from '../models/PreferenciaCartaz';

/** Teto do JSON guardado por chave — preferências são só texto/números/cores; nada perto disso é legítimo. */
const TAMANHO_MAXIMO_BYTES = 32 * 1024;

export const chavePreferenciaSchema = z.nativeEnum(ChavePreferenciaCartaz, {
  errorMap: () => ({ message: 'Preferência inválida.' }),
});

export const salvarPreferenciaSchema = z.object({
  valor: z
    .record(z.unknown())
    .refine((valor) => JSON.stringify(valor).length <= TAMANHO_MAXIMO_BYTES, { message: 'Preferências grandes demais.' }),
});
export type SalvarPreferenciaDTO = z.infer<typeof salvarPreferenciaSchema>;
