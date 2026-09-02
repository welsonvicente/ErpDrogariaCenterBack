import { z } from 'zod';

/**
 * Login de ADMIN/GESTOR: e-mail + senha.
 *
 * `organizacaoSlug` é opcional: quando o front já sabe a organização (rota
 * "/:orgSlug/gestor/login"), ele é enviado e a busca fica restrita a ela.
 * Quando não é enviado (tela inicial "/", antes de saber a organização), o
 * login busca o e-mail em todas as organizações — ver AuthService.login.
 */
export const loginSchema = z.object({
  organizacaoSlug: z.string().trim().min(1).optional(),
  email: z.string().email('E-mail inválido.'),
  senha: z.string().min(1, 'Senha é obrigatória.'),
});
export type LoginDTO = z.infer<typeof loginSchema>;

/** Login rápido de FUNCIONARIO: código + PIN, escopado pela organização. */
export const loginFuncionarioSchema = z.object({
  organizacaoSlug: z.string().trim().min(1, 'Organização é obrigatória.'),
  codigo: z.string().trim().min(1, 'Código é obrigatório.'),
  pin: z.string().trim().min(4, 'PIN deve ter ao menos 4 dígitos.').max(8),
});
export type LoginFuncionarioDTO = z.infer<typeof loginFuncionarioSchema>;
