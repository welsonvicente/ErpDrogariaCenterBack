import { z } from 'zod';

/** O `slug` nunca é editável por aqui — ele está espalhado em URLs/favoritos dos usuários. */
export const atualizarOrganizacaoSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres.'),
});
export type AtualizarOrganizacaoDTO = z.infer<typeof atualizarOrganizacaoSchema>;
