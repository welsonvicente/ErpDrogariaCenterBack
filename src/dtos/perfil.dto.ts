import { z } from 'zod';

/** Atualização dos próprios dados (nome/e-mail) pelo usuário autenticado. */
export const atualizarPerfilSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres.').optional(),
  email: z.string().email('E-mail inválido.').optional(),
});
export type AtualizarPerfilDTO = z.infer<typeof atualizarPerfilSchema>;

/** Troca de senha: exige a senha atual para confirmar que é o próprio dono da conta. */
export const alterarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, 'Senha atual é obrigatória.'),
  novaSenha: z.string().min(8, 'Nova senha deve ter ao menos 8 caracteres.'),
});
export type AlterarSenhaDTO = z.infer<typeof alterarSenhaSchema>;
