import { z } from 'zod';
import { ModoImportacaoEstoque } from '../models/EstoqueImportacao';
import { StatusAcaoEstoque } from '../models/EstoqueProduto';
import type { ConfigEstoque } from '../models/EstoqueConfig';

/** Valores de fábrica — espelhados no front (`utils/estoqueAnalise.ts`). */
export const CONFIG_ESTOQUE_PADRAO: ConfigEstoque = {
  faixas: { p1Min: 20, p2Min: 10, p3Min: 5, p4Min: 1 },
  diasAlerta: 180,
  diasCritico: 365,
  estoqueElevadoMin: 50,
  margemMinimaPct: 20,
  pesos: { quantidade: 50, valor: 30, tempo: 20 },
  nomesGrupos: {},
};

export const LIMITE_LINHAS_IMPORTACAO = 20000;

/** Limite do arquivo original guardado. O corpo da requisição (12 MB) também leva as linhas, então fica bem abaixo. */
export const LIMITE_ARQUIVO_ORIGINAL_BYTES = 5 * 1024 * 1024;

export const idEstoqueSchema = z.string().uuid('Id inválido.');

/** Texto opcional: string vazia vira null (campo limpo na tela = "não informado"). */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const numeroOpcional = z.number().finite().nullish().transform((v) => v ?? null);

const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a data no formato AAAA-MM-DD.')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida.');

/** Uma linha já normalizada pelo front (o front lê o Excel; o backend nunca vê o arquivo). */
export const linhaImportacaoSchema = z.object({
  codigoTrier: z.string().trim().min(1, 'Código Trier obrigatório.').max(40),
  codigoBarras: textoOpcional(40),
  produto: z.string().trim().min(1, 'Produto obrigatório.').max(255),
  laboratorio: textoOpcional(200),
  grupo: textoOpcional(200),
  fornecedor: textoOpcional(200),
  estoqueMinimo: numeroOpcional,
  demanda: numeroOpcional,
  saldo: numeroOpcional,
  custoUnitario: numeroOpcional,
  valorTotal: numeroOpcional,
  dataUltimaEntrada: dataIso.nullish().transform((v) => v ?? null),
  qtdUltimaCompra: numeroOpcional,
  precoUltimaCompra: numeroOpcional,
});
export type LinhaImportacaoDTO = z.infer<typeof linhaImportacaoSchema>;

export const importarEstoqueSchema = z.object({
  nomeArquivo: z.string().trim().min(1).max(255),
  modo: z.enum([ModoImportacaoEstoque.ATUALIZAR, ModoImportacaoEstoque.SUBSTITUIR]),
  /** Linhas de dados lidas no arquivo, contando as que o front descartou — só pra o histórico. */
  totalLinhasLidas: z.number().int().min(0).max(1_000_000).default(0),
  /** O .xlsx original, em base64 — opcional: sem ele a importação funciona igual, só não há o que baixar depois. */
  arquivo: z
    .object({
      mime: z.string().trim().min(1).max(120),
      conteudoBase64: z
        .string()
        .min(1)
        .refine((v) => Math.floor((v.length * 3) / 4) <= LIMITE_ARQUIVO_ORIGINAL_BYTES, `Arquivo original maior que ${LIMITE_ARQUIVO_ORIGINAL_BYTES / 1024 / 1024} MB.`),
    })
    .optional(),
  linhas: z.array(linhaImportacaoSchema).min(1, 'Nenhum produto válido para importar.').max(LIMITE_LINHAS_IMPORTACAO, `Máximo de ${LIMITE_LINHAS_IMPORTACAO} produtos por importação.`),
});
export type ImportarEstoqueDTO = z.infer<typeof importarEstoqueSchema>;

/** Campos que a gestão edita à mão num produto. Nada do que veio do relatório é editável aqui. */
const camposEdicao = {
  precoVenda: z.number().finite().min(0).nullish().transform((v) => v ?? null),
  acaoRecomendada: textoOpcional(4000),
  objetivo: textoOpcional(4000),
  comoExecutar: textoOpcional(8000),
  statusAcao: z.nativeEnum(StatusAcaoEstoque),
  responsavel: textoOpcional(120),
  dataInicio: dataIso.nullish().transform((v) => v ?? null),
  prazo: dataIso.nullish().transform((v) => v ?? null),
  observacoes: textoOpcional(4000),
  resultado: textoOpcional(4000),
  quantidadeAtualizada: z.number().finite().min(0).nullish().transform((v) => v ?? null),
  negociarFornecedor: z.boolean(),
};

export const atualizarProdutoEstoqueSchema = z
  .object(camposEdicao)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nenhum campo para atualizar.');
export type AtualizarProdutoEstoqueDTO = z.infer<typeof atualizarProdutoEstoqueSchema>;

/** Edição em lote: só os campos que fazem sentido aplicar a vários produtos de uma vez. */
export const atualizarLoteEstoqueSchema = z.object({
  ids: z.array(idEstoqueSchema).min(1).max(5000),
  campos: z
    .object({
      statusAcao: camposEdicao.statusAcao,
      responsavel: camposEdicao.responsavel,
      dataInicio: camposEdicao.dataInicio,
      prazo: camposEdicao.prazo,
      negociarFornecedor: camposEdicao.negociarFornecedor,
    })
    .partial()
    .strict()
    .refine((v) => Object.keys(v).length > 0, 'Nenhum campo para atualizar.'),
});
export type AtualizarLoteEstoqueDTO = z.infer<typeof atualizarLoteEstoqueSchema>;

export const configEstoqueSchema = z
  .object({
    faixas: z.object({
      p1Min: z.number().min(1),
      p2Min: z.number().min(1),
      p3Min: z.number().min(1),
      p4Min: z.number().min(0),
    }),
    diasAlerta: z.number().int().min(1).max(3650),
    diasCritico: z.number().int().min(1).max(3650),
    estoqueElevadoMin: z.number().min(1),
    margemMinimaPct: z.number().min(0).max(99),
    pesos: z.object({
      quantidade: z.number().min(0).max(100),
      valor: z.number().min(0).max(100),
      tempo: z.number().min(0).max(100),
    }),
    nomesGrupos: z
      .record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(80))
      .default({})
      .refine((r) => Object.keys(r).length <= 1000, 'Nomes de grupo demais.'),
    desconsiderarEntradas: z
      .object({ de: dataIso.nullable(), ate: dataIso.nullable() })
      .nullable()
      .optional()
      // Ausente = não mexe (config antiga); enviado vazio = considera tudo de novo.
      .transform((v) => (v === undefined ? undefined : v && (v.de || v.ate) ? v : null)),
  })
  .superRefine((c, ctx) => {
    const { p1Min, p2Min, p3Min, p4Min } = c.faixas;
    if (!(p1Min > p2Min && p2Min > p3Min && p3Min > p4Min)) {
      ctx.addIssue({ code: 'custom', path: ['faixas'], message: 'Os mínimos das faixas precisam ser decrescentes (P1 > P2 > P3 > P4).' });
    }
    if (c.diasCritico < c.diasAlerta) {
      ctx.addIssue({ code: 'custom', path: ['diasCritico'], message: 'O prazo crítico não pode ser menor que o de alerta.' });
    }
    const periodo = c.desconsiderarEntradas;
    if (periodo?.de && periodo.ate && periodo.de > periodo.ate) {
      ctx.addIssue({ code: 'custom', path: ['desconsiderarEntradas'], message: 'A data inicial do período desconsiderado não pode ser depois da final.' });
    }
    if (c.pesos.quantidade + c.pesos.valor + c.pesos.tempo <= 0) {
      ctx.addIssue({ code: 'custom', path: ['pesos'], message: 'Pelo menos um peso do ranking precisa ser maior que zero.' });
    }
  });

/** Cada aba da tela de histórico pede um recorte: importações, alterações manuais ou ações executadas. */
export const listarHistoricoQuerySchema = z.object({
  aba: z.enum(['importacoes', 'alteracoes', 'acoes']).optional(),
  /** Só o histórico de um produto (tela de detalhe). */
  codigoTrier: z.string().trim().min(1).max(40).optional(),
  limite: z.coerce.number().int().min(1).max(1000).default(300),
});
