import { z } from 'zod';
import { VereditoCritica } from '../models/CriticaPedido';

export const idCriticaSchema = z.string().uuid('Id inválido.');

/** Cada PDF original guardado pode ter até isto (o corpo da requisição, 12 MB, leva os dois + os dados lidos). */
export const LIMITE_PDF_BYTES = 3 * 1024 * 1024;

const texto = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);
/** Campo que só existe em alguns documentos: ausente fica ausente (não vira null no que é guardado). */
const textoSeExistir = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || undefined);
const num = z.number().finite();
const numOuNulo = z.number().finite().nullish().transform((v) => v ?? null);

const itemCota = z.object({
  id: z.number().int(),
  ean: texto(20),
  produto: z.string().trim().min(1).max(300),
  qtd: num,
  unitario: num,
  subtotal: num,
  /** Só quando o PDF juntou pedidos de várias distribuidoras. */
  distribuidora: textoSeExistir(200),
  pedidoNumero: textoSeExistir(80),
});

/** Um dos pedidos de um PDF que junta vários (um por distribuidora). */
const pedidoDaDistribuidora = z.object({
  numero: texto(80),
  distribuidora: z.string().trim().min(1).max(200),
  representante: texto(300),
  totalDeclarado: numOuNulo,
  minimoDistribuidora: numOuNulo,
  itens: z.number().int().min(0),
});

const itemTrier = z.object({
  id: z.number().int(),
  codigo: z.string().trim().min(1).max(40),
  produto: z.string().trim().min(1).max(300),
  laboratorio: texto(200),
  grupo: texto(40),
  estoque: numOuNulo,
  qtd: num,
  unitario: num,
  bruto: num,
  desconto: num,
  liquido: num,
  venda: numOuNulo,
});

const pedidoSchema = z.object({
  numero: texto(80),
  cotacao: texto(200),
  comprador: texto(200),
  compradorCnpj: texto(40),
  distribuidora: texto(200),
  representante: texto(300),
  totalDeclarado: numOuNulo,
  minimoDistribuidora: numOuNulo,
  geradoEm: texto(80),
  itens: z.array(itemCota).min(1).max(3000),
  pedidos: z.array(pedidoDaDistribuidora).max(100).optional(),
});

const relatorioSchema = z.object({
  filial: texto(200),
  periodo: texto(80),
  fornecedor: texto(200),
  emitidoEm: texto(80),
  totalLiquido: numOuNulo,
  itens: z.array(itemTrier).min(1).max(3000),
});

const decisaoSchema = z.union([z.object({ tipo: z.literal('confirmar') }), z.object({ tipo: z.literal('rejeitar') }), z.object({ tipo: z.literal('vincular'), trierIds: z.array(z.number().int()).min(1).max(50) })]);
/** Chave = id do primeiro item do pedido no grupo (número, mas em JSON vira texto). */
const decisoesSchema = z.record(z.string().regex(/^\d+$/), decisaoSchema).refine((r) => Object.keys(r).length <= 3000, 'Decisões demais.');

/** Chave = chave estável da linha ("c3" = parte do pedido, "t7" = só no Trier). */
const anotacoesSchema = z
  .record(z.string().regex(/^[ct]\d+$/), z.object({ motivo: z.string().trim().max(40).nullable(), texto: z.string().trim().max(500) }))
  .refine((r) => Object.keys(r).length <= 3000, 'Anotações demais.');

const toleranciasSchema = z.object({
  arredondamento: z.number().min(0).max(100),
  pequenoReais: z.number().min(0).max(1000),
  pequenoPct: z.number().min(0).max(100),
});

const resumoSchema = z.object({
  veredito: z.nativeEnum(VereditoCritica),
  totalPedido: numOuNulo,
  totalTrier: numOuNulo,
  diferenca: numOuNulo,
  contagens: z.record(z.string().max(30), z.number().int().min(0)),
});

const pdfSchema = z
  .object({
    nome: z.string().trim().min(1).max(255),
    conteudoBase64: z
      .string()
      .min(1)
      .refine((v) => Math.floor((v.length * 3) / 4) <= LIMITE_PDF_BYTES, `PDF maior que ${LIMITE_PDF_BYTES / 1024 / 1024} MB.`),
  })
  .optional();

export const criarCriticaSchema = z.object({
  titulo: z.string().trim().min(1, 'Dê um nome para a crítica.').max(200),
  pedido: pedidoSchema,
  relatorio: relatorioSchema,
  decisoes: decisoesSchema.default({}),
  anotacoes: anotacoesSchema.default({}),
  tolerancias: toleranciasSchema,
  resumo: resumoSchema,
  pdfCota: pdfSchema,
  pdfTrier: pdfSchema,
});
export type CriarCriticaDTO = z.infer<typeof criarCriticaSchema>;

/**
 * Reabrir e decidir de novo muda decisões/tolerâncias/resumo. Os documentos só mudam quando vêm no corpo
 * (a pessoa trocou o PDF): `pedido`/`relatorio` substituem os dados lidos, e o PDF original guardado
 * acompanha — se o documento foi trocado e não veio PDF novo, o PDF antigo é apagado, porque deixaria de
 * corresponder aos dados.
 */
export const atualizarCriticaSchema = z.object({
  titulo: z.string().trim().min(1).max(200).optional(),
  pedido: pedidoSchema.optional(),
  relatorio: relatorioSchema.optional(),
  pdfCota: pdfSchema,
  pdfTrier: pdfSchema,
  decisoes: decisoesSchema,
  /** Ausente = não mexe nas anotações guardadas. */
  anotacoes: anotacoesSchema.optional(),
  tolerancias: toleranciasSchema,
  resumo: resumoSchema,
});
export type AtualizarCriticaDTO = z.infer<typeof atualizarCriticaSchema>;

export const qualPdfSchema = z.enum(['cota', 'trier']);
