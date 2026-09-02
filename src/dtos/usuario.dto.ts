import { z } from 'zod';

/** Cadastro de funcionário pelo gestor: nome + código + PIN de acesso. */
export const criarFuncionarioSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres.'),
  codigo: z.string().trim().min(1, 'Código é obrigatório.').max(12),
  pin: z.string().trim().min(4, 'PIN deve ter ao menos 4 dígitos.').max(8),
  icone: z.string().trim().min(1).max(8).default('🙂'),
});
export type CriarFuncionarioDTO = z.infer<typeof criarFuncionarioSchema>;

export const atualizarFuncionarioSchema = z.object({
  nome: z.string().trim().min(2).optional(),
  codigo: z.string().trim().min(1).max(12).optional(),
  pin: z.string().trim().min(4).max(8).optional(),
  icone: z.string().trim().min(1).max(8).optional(),
  ativo: z.boolean().optional(),
});
export type AtualizarFuncionarioDTO = z.infer<typeof atualizarFuncionarioSchema>;
