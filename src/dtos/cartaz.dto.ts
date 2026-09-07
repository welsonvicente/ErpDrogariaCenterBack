import { z } from 'zod';

/** Busca de imagem de produto pra ferramenta de Cartazes (nome + EAN, opcional). */
export const buscarImagemSchema = z.object({
  descricao: z.string().trim().min(2, 'Descrição do produto é obrigatória.'),
  ean: z.string().trim().optional(),
});
export type BuscarImagemDTO = z.infer<typeof buscarImagemSchema>;
