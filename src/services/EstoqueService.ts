import { EntityManager } from 'typeorm';
import { logger } from '../config/logger';
import {
  AtualizarLoteEstoqueDTO,
  AtualizarProdutoEstoqueDTO,
  CONFIG_ESTOQUE_PADRAO,
  ImportarEstoqueDTO,
  LinhaImportacaoDTO,
} from '../dtos/estoque.dto';
import { ConfigEstoque } from '../models/EstoqueConfig';
import { TipoHistoricoEstoque } from '../models/EstoqueHistorico';
import { EstoqueImportacao, ModoImportacaoEstoque, ResumoImportacaoEstoque } from '../models/EstoqueImportacao';
import { EstoqueProduto, StatusAcaoEstoque } from '../models/EstoqueProduto';
import { EstoqueRepository } from '../repositories/EstoqueRepository';
import { UsuarioRepository } from '../repositories/UsuarioRepository';
import { AppError } from '../utils/AppError';
import { AuditoriaService } from './AuditoriaService';

/** Autor da ação — vira texto no histórico (o nome fica copiado: apagar/renomear a conta depois não reescreve o passado). */
export interface AutorEstoque {
  nome: string;
  email: string | null;
}

/** Colunas (nome no banco) que uma importação sobrescreve num produto que já existe. Nunca inclui campos da gestão. */
const COLUNAS_DO_RELATORIO = [
  'codigo_barras',
  'produto',
  'laboratorio',
  'grupo',
  'fornecedor',
  'estoque_minimo',
  'demanda',
  'saldo',
  'custo_unitario',
  'valor_total',
  'data_ultima_entrada',
  'qtd_ultima_compra',
  'preco_ultima_compra',
  'ativo',
  'importacao_id',
  'atualizado_em',
];

const TAMANHO_LOTE_INSERT = 500;

/** Campos de edição manual e quais deles contam como "plano de ação" (mexer neles atualiza `acaoAtualizadaEm`). */
const CAMPOS_ACAO: Array<keyof AtualizarProdutoEstoqueDTO> = [
  'acaoRecomendada',
  'objetivo',
  'comoExecutar',
  'statusAcao',
  'responsavel',
  'dataInicio',
  'prazo',
  'observacoes',
  'resultado',
  'quantidadeAtualizada',
  'negociarFornecedor',
];

const ROTULO_CAMPO: Record<string, string> = {
  precoVenda: 'Preço de venda',
  acaoRecomendada: 'Ação recomendada',
  objetivo: 'Objetivo',
  comoExecutar: 'Como executar',
  statusAcao: 'Status da ação',
  responsavel: 'Responsável',
  dataInicio: 'Data de início',
  prazo: 'Prazo',
  observacoes: 'Observações',
  resultado: 'Resultado obtido',
  quantidadeAtualizada: 'Quantidade atualizada',
  negociarFornecedor: 'Negociar com fornecedor',
};

function textoDoValor(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  return String(valor);
}

/** Remove duplicatas pelo código Trier (a última ocorrência vence) — o Postgres recusa o mesmo código duas vezes no mesmo INSERT ... ON CONFLICT. */
function deduplicarPorCodigo(linhas: LinhaImportacaoDTO[]) {
  const porCodigo = new Map<string, LinhaImportacaoDTO>();
  for (const linha of linhas) porCodigo.set(linha.codigoTrier, linha);
  return { unicas: [...porCodigo.values()], duplicadas: linhas.length - porCodigo.size };
}

export class EstoqueService {
  // ---------------------------------------------------------------- leitura

  static listarProdutos(organizacaoId: string) {
    return EstoqueRepository.listarProdutos(organizacaoId);
  }

  static listarImportacoes(organizacaoId: string) {
    return EstoqueRepository.listarImportacoes(organizacaoId);
  }

  static listarHistorico(organizacaoId: string, tipos: TipoHistoricoEstoque[] | null, limite: number, codigoTrier?: string) {
    return EstoqueRepository.listarHistorico(organizacaoId, tipos, limite, codigoTrier);
  }

  // ------------------------------------------------------------- importação

  /**
   * Importa o relatório do Trier.
   *
   * - ATUALIZAR: relaciona pelo código Trier. O que já existia tem só os dados do
   *   relatório atualizados (plano de ação, observações e preço de venda ficam
   *   como estão); o que é novo entra; o que não veio no arquivo continua
   *   guardado, marcado como "fora do relatório".
   * - SUBSTITUIR: apaga tudo que existia — inclusive ações — e começa do zero.
   *
   * Tudo na mesma transação: se qualquer passo falha, nada muda.
   */
  static async importar(organizacaoId: string, autor: AutorEstoque, dados: ImportarEstoqueDTO) {
    const { unicas, duplicadas } = deduplicarPorCodigo(dados.linhas);
    const arquivo = dados.arquivo ? Buffer.from(dados.arquivo.conteudoBase64, 'base64') : null;
    const ignoradasNoArquivo = Math.max(0, dados.totalLinhasLidas - dados.linhas.length) + duplicadas;

    const importacao = await EstoqueRepository.transacao(async (manager) => {
      const registro = await manager.save(
        manager.create(EstoqueImportacao, {
          organizacaoId,
          nomeArquivo: dados.nomeArquivo,
          modo: dados.modo,
          totalLinhas: Math.max(dados.totalLinhasLidas, dados.linhas.length),
          totalProdutos: unicas.length,
          resumo: { novos: 0, atualizados: 0, saiuDoRelatorio: 0, ignoradas: ignoradasNoArquivo, removidos: 0 },
          linhas: unicas as unknown as Array<Record<string, unknown>>,
          usuarioNome: autor.nome,
          ...(arquivo ? { arquivoOriginal: arquivo, arquivoMime: dados.arquivo!.mime, arquivoTamanho: arquivo.length } : {}),
        }),
      );

      const resumo = await this.aplicarLinhas(manager, organizacaoId, unicas, dados.modo === ModoImportacaoEstoque.SUBSTITUIR, registro.id);
      registro.resumo = { ...resumo, ignoradas: ignoradasNoArquivo };
      await manager.save(registro);

      await EstoqueRepository.registrarHistorico(
        [
          {
            organizacaoId,
            tipo: TipoHistoricoEstoque.IMPORTACAO,
            descricao: this.descreverImportacao(dados.modo === ModoImportacaoEstoque.SUBSTITUIR ? 'Substituiu os dados com' : 'Atualizou os dados com', dados.nomeArquivo, registro.resumo),
            usuarioNome: autor.nome,
          },
        ],
        manager,
      );
      return registro;
    });

    await AuditoriaService.registrar(
      organizacaoId,
      autor,
      dados.modo === ModoImportacaoEstoque.SUBSTITUIR ? 'Substituiu o relatório de estoque parado' : 'Importou o relatório de estoque parado',
      this.descreverImportacao('', dados.nomeArquivo, importacao.resumo),
    );
    logger.info('Relatório de estoque importado', { organizacaoId, importacaoId: importacao.id, modo: dados.modo, resumo: importacao.resumo });

    return this.semSnapshot(importacao);
  }

  /** Reaplica o snapshot de uma importação anterior (modo ATUALIZAR: ações e observações atuais ficam como estão). */
  static async restaurar(organizacaoId: string, autor: AutorEstoque, importacaoId: string) {
    const origem = await EstoqueRepository.findImportacao(organizacaoId, importacaoId);
    if (!origem) throw AppError.notFound('Importação', importacaoId);

    const linhas = origem.linhas as unknown as LinhaImportacaoDTO[];

    const nova = await EstoqueRepository.transacao(async (manager) => {
      const registro = await manager.save(
        manager.create(EstoqueImportacao, {
          organizacaoId,
          nomeArquivo: origem.nomeArquivo,
          modo: ModoImportacaoEstoque.RESTAURACAO,
          totalLinhas: linhas.length,
          totalProdutos: linhas.length,
          resumo: { novos: 0, atualizados: 0, saiuDoRelatorio: 0, ignoradas: 0, removidos: 0 },
          linhas: origem.linhas,
          restauradaDeId: origem.id,
          usuarioNome: autor.nome,
        }),
      );
      registro.resumo = await this.aplicarLinhas(manager, organizacaoId, linhas, false, registro.id);
      await manager.save(registro);

      await EstoqueRepository.registrarHistorico(
        [
          {
            organizacaoId,
            tipo: TipoHistoricoEstoque.RESTAURACAO,
            descricao: this.descreverImportacao(
              `Restaurou a importação de ${origem.criadoEm.toLocaleDateString('pt-BR')} com`,
              origem.nomeArquivo,
              registro.resumo,
            ),
            usuarioNome: autor.nome,
          },
        ],
        manager,
      );
      return registro;
    });

    await AuditoriaService.registrar(organizacaoId, autor, 'Restaurou uma importação de estoque parado', this.descreverImportacao('', origem.nomeArquivo, nova.resumo));
    return this.semSnapshot(nova);
  }

  private static async aplicarLinhas(
    manager: EntityManager,
    organizacaoId: string,
    linhas: LinhaImportacaoDTO[],
    substituirTudo: boolean,
    importacaoId: string,
  ): Promise<ResumoImportacaoEstoque> {
    let removidos = 0;
    if (substituirTudo) {
      const apagados = await manager.delete(EstoqueProduto, { organizacaoId });
      removidos = apagados.affected ?? 0;
    }

    const existentes = await manager.find(EstoqueProduto, { where: { organizacaoId }, select: ['id', 'codigoTrier'] });
    const codigosExistentes = new Set(existentes.map((p) => p.codigoTrier));
    const novos = linhas.filter((l) => !codigosExistentes.has(l.codigoTrier)).length;

    for (let i = 0; i < linhas.length; i += TAMANHO_LOTE_INSERT) {
      const lote = linhas.slice(i, i + TAMANHO_LOTE_INSERT).map((l) => ({
        organizacaoId,
        codigoTrier: l.codigoTrier,
        codigoBarras: l.codigoBarras,
        produto: l.produto,
        laboratorio: l.laboratorio,
        grupo: l.grupo,
        fornecedor: l.fornecedor,
        estoqueMinimo: l.estoqueMinimo,
        demanda: l.demanda,
        saldo: l.saldo,
        custoUnitario: l.custoUnitario,
        valorTotal: l.valorTotal,
        dataUltimaEntrada: l.dataUltimaEntrada,
        qtdUltimaCompra: l.qtdUltimaCompra,
        precoUltimaCompra: l.precoUltimaCompra,
        ativo: true,
        importacaoId,
      }));
      // O conflito é na (organização, código Trier): é aqui que "atualizar sem
      // perder o plano de ação" acontece — só as colunas do relatório entram no
      // DO UPDATE; status, responsável, observações etc. nunca são citados.
      await manager
        .createQueryBuilder()
        .insert()
        .into(EstoqueProduto)
        .values(lote)
        .orUpdate(COLUNAS_DO_RELATORIO, ['organizacao_id', 'codigo_trier'])
        .execute();
    }

    const codigosDoArquivo = linhas.map((l) => l.codigoTrier);
    const saiu = await manager
      .createQueryBuilder()
      .update(EstoqueProduto)
      .set({ ativo: false })
      .where('organizacao_id = :organizacaoId', { organizacaoId })
      .andWhere('ativo = true')
      .andWhere('NOT (codigo_trier = ANY(:codigos))', { codigos: codigosDoArquivo })
      .execute();

    return {
      novos,
      atualizados: linhas.length - novos,
      saiuDoRelatorio: saiu.affected ?? 0,
      ignoradas: 0,
      removidos,
    };
  }

  private static descreverImportacao(prefixo: string, arquivo: string, r: ResumoImportacaoEstoque) {
    const partes = [`${r.novos} novos`, `${r.atualizados} atualizados`];
    if (r.saiuDoRelatorio) partes.push(`${r.saiuDoRelatorio} saíram do relatório`);
    if (r.removidos) partes.push(`${r.removidos} apagados`);
    if (r.ignoradas) partes.push(`${r.ignoradas} linhas ignoradas`);
    return `${prefixo ? prefixo + ' ' : ''}"${arquivo}" — ${partes.join(', ')}.`;
  }

  private static semSnapshot(importacao: EstoqueImportacao) {
    // Nem o snapshot nem o binário do arquivo voltam na resposta: só o tamanho (pra tela saber que há arquivo).
    const { linhas: _linhas, arquivoOriginal: _arquivo, ...resto } = importacao;
    void _linhas;
    void _arquivo;
    return resto;
  }

  /** O .xlsx original de uma importação — 404 se não existe, é de outra organização ou foi importado sem arquivo. */
  static async baixarArquivoOriginal(organizacaoId: string, importacaoId: string) {
    const importacao = await EstoqueRepository.findArquivoOriginal(organizacaoId, importacaoId);
    if (!importacao?.arquivoOriginal) throw AppError.notFound('Arquivo da importação', importacaoId);
    return { nome: importacao.nomeArquivo, mime: importacao.arquivoMime ?? 'application/octet-stream', conteudo: importacao.arquivoOriginal };
  }

  // ---------------------------------------------------------------- edição

  static async atualizarProduto(organizacaoId: string, autor: AutorEstoque, id: string, dados: AtualizarProdutoEstoqueDTO) {
    const produto = await EstoqueRepository.findProduto(organizacaoId, id);
    if (!produto) throw AppError.notFound('Produto', id);

    const historico = this.aplicarEdicao(organizacaoId, autor, produto, dados);

    await EstoqueRepository.transacao(async (manager) => {
      await EstoqueRepository.salvarProduto(produto, manager);
      await EstoqueRepository.registrarHistorico(historico, manager);
    });
    return produto;
  }

  static async atualizarLote(organizacaoId: string, autor: AutorEstoque, dados: AtualizarLoteEstoqueDTO) {
    const produtos = await EstoqueRepository.findProdutosPorIds(organizacaoId, dados.ids);
    if (!produtos.length) throw AppError.notFound('Produtos');

    const historico = produtos.flatMap((p) => this.aplicarEdicao(organizacaoId, autor, p, dados.campos));
    await EstoqueRepository.transacao(async (manager) => {
      await manager.save(produtos, { chunk: 200 });
      await EstoqueRepository.registrarHistorico(historico, manager);
    });
    logger.info('Edição em lote de estoque', { organizacaoId, produtos: produtos.length, campos: Object.keys(dados.campos) });
    return produtos;
  }

  /** Aplica a edição no objeto (sem salvar) e devolve as linhas de histórico dos campos que de fato mudaram. */
  private static aplicarEdicao(organizacaoId: string, autor: AutorEstoque, produto: EstoqueProduto, dados: AtualizarProdutoEstoqueDTO) {
    const historico: Parameters<typeof EstoqueRepository.registrarHistorico>[0] = [];
    let mexeuNoPlano = false;

    for (const [campo, novo] of Object.entries(dados) as Array<[keyof AtualizarProdutoEstoqueDTO, unknown]>) {
      const anterior = (produto as unknown as Record<string, unknown>)[campo];
      if (textoDoValor(anterior) === textoDoValor(novo)) continue;

      (produto as unknown as Record<string, unknown>)[campo] = novo;
      if (CAMPOS_ACAO.includes(campo)) mexeuNoPlano = true;

      historico.push({
        organizacaoId,
        tipo: campo === 'statusAcao' ? TipoHistoricoEstoque.ACAO : TipoHistoricoEstoque.EDICAO,
        codigoTrier: produto.codigoTrier,
        produtoNome: produto.produto,
        campo: ROTULO_CAMPO[campo] ?? campo,
        valorAnterior: textoDoValor(anterior),
        valorNovo: textoDoValor(novo),
        usuarioNome: autor.nome,
      });
    }

    if (mexeuNoPlano) produto.acaoAtualizadaEm = new Date();
    return historico;
  }

  // ----------------------------------------------------------- configuração

  static async obterConfig(organizacaoId: string): Promise<ConfigEstoque> {
    const salva = await EstoqueRepository.findConfig(organizacaoId);
    const c = salva?.config;
    // Mescla com o padrão: se um campo novo for criado no futuro, quem já tem
    // configuração salva recebe o valor de fábrica em vez de `undefined`.
    return {
      ...CONFIG_ESTOQUE_PADRAO,
      ...c,
      faixas: { ...CONFIG_ESTOQUE_PADRAO.faixas, ...c?.faixas },
      pesos: { ...CONFIG_ESTOQUE_PADRAO.pesos, ...c?.pesos },
      nomesGrupos: { ...c?.nomesGrupos },
    };
  }

  static async salvarConfig(organizacaoId: string, autor: AutorEstoque, config: ConfigEstoque) {
    const anterior = await this.obterConfig(organizacaoId);
    await EstoqueRepository.salvarConfig(organizacaoId, config);
    await EstoqueRepository.registrarHistorico([
      {
        organizacaoId,
        tipo: TipoHistoricoEstoque.CONFIG,
        descricao: 'Alterou as configurações da análise de estoque.',
        valorAnterior: JSON.stringify(anterior),
        valorNovo: JSON.stringify(config),
        usuarioNome: autor.nome,
      },
    ]);
    await AuditoriaService.registrar(organizacaoId, autor, 'Alterou as configurações da análise de estoque');
    return config;
  }

  // ------------------------------------------------------------------ autor

  static async autorDe(organizacaoId: string, usuarioId: string): Promise<AutorEstoque> {
    const usuario = await UsuarioRepository.findByIdInOrganizacao(organizacaoId, usuarioId);
    return { nome: usuario?.nome ?? 'Usuário', email: usuario?.email ?? null };
  }
}

export { StatusAcaoEstoque };
