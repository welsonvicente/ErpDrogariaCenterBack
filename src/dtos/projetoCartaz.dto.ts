import { z } from 'zod';
import { TipoProjetoCartaz } from '../models/ProjetoCartaz';

/** `:id` de projeto na URL — barra cedo um id mal formado (não é "de outra organização", é só inválido). */
export const projetoIdSchema = z.string().uuid('Id de projeto inválido.');

export const criarProjetoSchema = z.object({
  tipo: z.nativeEnum(TipoProjetoCartaz, { errorMap: () => ({ message: 'Tipo de projeto inválido.' }) }),
  nome: z.string().trim().min(1, 'Nome do projeto é obrigatório.').max(120),
});
export type CriarProjetoDTO = z.infer<typeof criarProjetoSchema>;

export const listarProjetosQuerySchema = z.object({
  tipo: z.nativeEnum(TipoProjetoCartaz, { errorMap: () => ({ message: 'Tipo de projeto inválido.' }) }).optional(),
});
export type ListarProjetosQueryDTO = z.infer<typeof listarProjetosQuerySchema>;

/** Autosave do editor (nome e/ou `estadoEditor`) — o formato de `estadoEditor` é decidido pelo front, o backend só guarda e devolve. */
export const atualizarProjetoSchema = z
  .object({
    nome: z.string().trim().min(1, 'Nome do projeto é obrigatório.').max(120).optional(),
    estadoEditor: z.record(z.unknown()).optional(),
  })
  .refine((dados) => dados.nome !== undefined || dados.estadoEditor !== undefined, {
    message: 'Informe ao menos um campo para atualizar (nome ou estadoEditor).',
  });
export type AtualizarProjetoDTO = z.infer<typeof atualizarProjetoSchema>;
