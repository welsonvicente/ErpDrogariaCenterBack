import { z } from 'zod';

/** Chave do armazenamento (identifica qual ferramenta/estado é), vinda da URL. */
export const chaveArmazenamentoSchema = z
  .string()
  .trim()
  .min(1, 'Chave é obrigatória.')
  .max(120)
  .regex(/^[a-z0-9-]+$/, 'Chave deve conter só letras minúsculas, números e hífen.');

/**
 * Corpo de `PUT /armazenamento/:chave` — o valor é sempre uma string opaca
 * (normalmente um JSON serializado pela própria ferramenta). `versaoEsperada`
 * é opcional (compatibilidade com quem ainda não manda) — quando presente,
 * ativa o controle de concorrência otimista (ver ArmazenamentoAppService).
 */
export const salvarArmazenamentoSchema = z.object({
  // Toda ferramenta que usa esse armazenamento serializa um objeto em JSON
  // antes de mandar — um valor que não é JSON válido é sinal de bug no
  // cliente (ou corrupção em trânsito), não um uso legítimo do "valor
  // opaco". Rejeitar aqui evita persistir algo que quebraria a ferramenta
  // pra todo mundo na próxima leitura, sem exigir da rota nenhum
  // conhecimento do formato específico de cada ferramenta.
  valor: z.string().refine(
    (v) => {
      try {
        JSON.parse(v);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'O valor deve ser um JSON válido.' },
  ),
  versaoEsperada: z.number().int().min(0).optional(),
});
export type SalvarArmazenamentoDTO = z.infer<typeof salvarArmazenamentoSchema>;
