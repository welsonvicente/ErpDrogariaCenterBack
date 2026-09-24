import { z } from 'zod';

const TAMANHO_MAXIMO_BYTES = 8 * 1024 * 1024; // 8MB — folga generosa pra uma planilha (sem foto embutida), sem exagerar no banco.

/** `:id` de arquivo na URL — barra cedo um id mal formado (não é "de outra organização", é só inválido). */
export const arquivoIdSchema = z.string().uuid('Id de arquivo inválido.');

/** Corpo de `POST /cartazes/arquivos` — o arquivo vai em base64 dentro do JSON (não há upload multipart nesse backend). */
export const enviarArquivoSchema = z.object({
  nomeArquivo: z.string().trim().min(1, 'Nome do arquivo é obrigatório.').max(255),
  mimeType: z.string().trim().min(1).max(120),
  conteudoBase64: z
    .string()
    .min(1, 'Arquivo vazio.')
    .refine((v) => {
      // Tamanho decodificado a partir do comprimento em base64, sem decodificar de verdade (evita gastar memória só pra validar).
      const bytesEstimado = Math.floor((v.length * 3) / 4);
      return bytesEstimado <= TAMANHO_MAXIMO_BYTES;
    }, `Arquivo maior que o limite de ${TAMANHO_MAXIMO_BYTES / 1024 / 1024}MB.`),
});
export type EnviarArquivoDTO = z.infer<typeof enviarArquivoSchema>;
