import { ValueTransformer } from 'typeorm';

/**
 * O driver do Postgres devolve `numeric` como string (pra não perder precisão),
 * o que obrigaria o front a `Number(...)` cada campo. Nas colunas de estoque
 * (quantidades e custos com poucas casas) o `number` do JS é exato o bastante,
 * então convertemos na borda do banco — e preservamos o `null`, que aqui
 * significa "não informado no relatório" (diferente de zero).
 */
export const numericTransformer: ValueTransformer = {
  to: (valor?: number | null) => valor ?? null,
  from: (valor?: string | null) => (valor === null || valor === undefined ? null : Number(valor)),
};
