import { z } from 'zod';

/** Cadastro público de uma organização nova + seu primeiro usuário (ADMIN). */
export const registrarOrganizacaoSchema = z.object({
  nomeOrganizacao: z.string().trim().min(2, 'Nome da empresa deve ter ao menos 2 caracteres.'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Endereço deve ter ao menos 3 caracteres.')
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use só letras minúsculas, números e hífen (ex: minha-empresa).'),
  nomeAdmin: z.string().trim().min(2, 'Seu nome deve ter ao menos 2 caracteres.'),
  email: z.string().trim().email('E-mail inválido.'),
  senha: z.string().min(8, 'Senha deve ter ao menos 8 caracteres.'),
});
export type RegistrarOrganizacaoDTO = z.infer<typeof registrarOrganizacaoSchema>;
