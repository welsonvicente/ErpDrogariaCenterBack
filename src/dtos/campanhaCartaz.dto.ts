import { z } from 'zod';

/** Mesmo teto do lote do Cartaz de oferta quando era preferência (ver preferenciaCartaz.dto.ts). */
const TAMANHO_MAXIMO_FOLHA_BYTES = 512 * 1024;

export const campanhaIdSchema = z.string().uuid('Id de campanha inválido.');

const nome = z.string().trim().min(1, 'Nome da campanha é obrigatório.').max(120);

/** Chaves de aparência que a campanha guarda (mesmo formato das preferências antigas). */
const aparencia = z
  .object({
    story: z.record(z.unknown()).optional(),
    panfleto: z.record(z.unknown()).optional(),
    planilha: z.record(z.unknown()).optional(),
    logo_story: z.record(z.unknown()).optional(),
  })
  .strict()
  .refine((valor) => JSON.stringify(valor).length <= TAMANHO_MAXIMO_FOLHA_BYTES, { message: 'Aparência grande demais.' });

export const criarCampanhaSchema = z.object({ nome, aparencia: aparencia.optional() });

export const atualizarCampanhaSchema = z
  .object({
    nome: nome.optional(),
    folhaOferta: z
      .record(z.unknown())
      .refine((valor) => JSON.stringify(valor).length <= TAMANHO_MAXIMO_FOLHA_BYTES, { message: 'Folha do cartaz grande demais.' })
      .optional(),
    aparencia: aparencia.optional(),
  })
  .refine((dados) => dados.nome !== undefined || dados.folhaOferta !== undefined || dados.aparencia !== undefined, {
    message: 'Informe ao menos um campo para atualizar (nome, folhaOferta ou aparencia).',
  });
