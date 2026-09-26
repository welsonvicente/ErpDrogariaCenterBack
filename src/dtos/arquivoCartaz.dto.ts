import { z } from 'zod';

/** Formatos aceitos das imagens de produto usadas em Cartazes — mesmo escopo do que já é gerado/reduzido no front (ver `arquivoImagem.ts`). */
export const MIME_TYPES_IMAGEM_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Folga generosa sobre qualquer foto de câmera já reduzida no front (no máximo 1600px) — nunca deve ser atingido na prática. */
export const TAMANHO_MAXIMO_IMAGEM_BYTES = 12 * 1024 * 1024;

/** `:id` de arquivo na URL. */
export const arquivoIdSchema = z.string().uuid('Id de arquivo inválido.');

/** Corpo de `POST /cartazes/imagens/presign`. `projetoId` é opcional: o front pode subir a foto antes de decidir/criar o projeto final. */
export const presignArquivoSchema = z.object({
  projetoId: z.string().uuid('Id de projeto inválido.').optional(),
  mimeType: z.enum(MIME_TYPES_IMAGEM_PERMITIDOS, {
    errorMap: () => ({ message: 'Formato de imagem não suportado (use JPEG, PNG ou WEBP).' }),
  }),
  tamanhoBytes: z
    .number()
    .int()
    .positive('Arquivo vazio.')
    .max(TAMANHO_MAXIMO_IMAGEM_BYTES, `Arquivo maior que o limite de ${TAMANHO_MAXIMO_IMAGEM_BYTES / 1024 / 1024}MB.`),
});
export type PresignArquivoDTO = z.infer<typeof presignArquivoSchema>;

/**
 * Corpo de `POST /cartazes/imagens/:id/confirmar` — qual projeto esse arquivo
 * passa a pertencer. `projetoId` é opcional: usado também pra confirmar uma
 * foto que vai direto pra "produtos recentes" (Story/Panfleto), sem projeto —
 * nesse caso o arquivo fica `confirmado` mas sem vínculo, e só é apagado
 * quando a própria lista de recentes descarta essa entrada (nunca pelo job de
 * limpeza, que só toca em `pendente`).
 */
export const confirmarArquivoSchema = z.object({
  projetoId: z.string().uuid('Id de projeto inválido.').optional(),
});
export type ConfirmarArquivoDTO = z.infer<typeof confirmarArquivoSchema>;

/** Corpo de `POST /cartazes/imagens/urls` — busca em lote as URLs de leitura de arquivos já confirmados (ex.: montar as miniaturas de "produtos recentes"). */
export const obterUrlsArquivosSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});
export type ObterUrlsArquivosDTO = z.infer<typeof obterUrlsArquivosSchema>;

/** Corpo de `POST /cartazes/imagens/:id/duplicar` — pra qual projeto a cópia vai pertencer (ver "produtos recentes"). */
export const duplicarArquivoSchema = z.object({
  projetoId: z.string().uuid('Id de projeto inválido.'),
});
export type DuplicarArquivoDTO = z.infer<typeof duplicarArquivoSchema>;
