import { z } from 'zod';

export const criarCategoriaSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres.'),
  icone: z.string().trim().min(1).max(8).default('✳️'),
  ordem: z.number().int().nonnegative().default(0),
});
export type CriarCategoriaDTO = z.infer<typeof criarCategoriaSchema>;

export const atualizarCategoriaSchema = criarCategoriaSchema.partial().extend({
  ativo: z.boolean().optional(),
});
export type AtualizarCategoriaDTO = z.infer<typeof atualizarCategoriaSchema>;
