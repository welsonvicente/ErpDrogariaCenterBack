import { z } from 'zod';

/** usuarioId NÃO vem no corpo: é sempre derivado do token de quem está autenticado (evita lançar despesa em nome de outro usuário). */
export const criarDespesaSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD.'),
  valor: z.number().positive('Valor deve ser maior que zero.'),
  descricao: z.string().trim().max(500).optional().nullable(),
  categoriaId: z.string().uuid('categoriaId inválido.'),
});
export type CriarDespesaDTO = z.infer<typeof criarDespesaSchema>;

export const atualizarDespesaSchema = criarDespesaSchema.partial();
export type AtualizarDespesaDTO = z.infer<typeof atualizarDespesaSchema>;

export const listarDespesasQuerySchema = z.object({
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  usuarioId: z.string().uuid().optional(),
  categoriaId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export type ListarDespesasQueryDTO = z.infer<typeof listarDespesasQuerySchema>;
