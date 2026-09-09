import { z } from 'zod';

/** Chave do armazenamento (identifica qual ferramenta/estado é), vinda da URL. */
export const chaveArmazenamentoSchema = z
  .string()
  .trim()
  .min(1, 'Chave é obrigatória.')
  .max(120)
  .regex(/^[a-z0-9-]+$/, 'Chave deve conter só letras minúsculas, números e hífen.');

/** Corpo de `PUT /armazenamento/:chave` — o valor é sempre uma string opaca (normalmente um JSON serializado pela própria ferramenta). */
export const salvarArmazenamentoSchema = z.object({
  valor: z.string(),
});
export type SalvarArmazenamentoDTO = z.infer<typeof salvarArmazenamentoSchema>;
