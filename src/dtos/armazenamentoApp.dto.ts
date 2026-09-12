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

/**
 * Corpo de `POST /armazenamento/:chave/elevar` — usado hoje só pela chave
 * da ferramenta de Folgas (ver FolgasSigiloService) pra provar acesso de
 * gestor sem nunca expor a credencial real na checagem em si.
 */
export const elevarArmazenamentoSchema = z.union([
  // `papel` não vem do corpo: o cliente não sabe mais quais papéis existem
  // (rolePasswords fica oculto) — o servidor testa a senha contra todos e
  // devolve qual papel bateu.
  z.object({ tipo: z.literal('papel'), senha: z.string().min(1) }),
  z.object({ tipo: z.literal('funcionario'), funcionarioId: z.string().min(1), codigo: z.string().min(1) }),
]);
export type ElevarArmazenamentoDTO = z.infer<typeof elevarArmazenamentoSchema>;
