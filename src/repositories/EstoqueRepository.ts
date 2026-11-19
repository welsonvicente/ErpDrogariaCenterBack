import { EntityManager } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { EstoqueConfig, ConfigEstoque } from '../models/EstoqueConfig';
import { EstoqueHistorico, TipoHistoricoEstoque } from '../models/EstoqueHistorico';
import { EstoqueImportacao } from '../models/EstoqueImportacao';
import { EstoqueProduto } from '../models/EstoqueProduto';

/**
 * Acesso a dados do módulo de estoque. Uma classe só (e não uma por tabela)
 * porque as quatro tabelas sempre andam juntas — toda importação mexe em
 * produtos, importação e histórico na mesma transação.
 */
export class EstoqueRepository {
  private static get produtos() {
    return AppDataSource.getRepository(EstoqueProduto);
  }
  private static get importacoes() {
    return AppDataSource.getRepository(EstoqueImportacao);
  }
  private static get historico() {
    return AppDataSource.getRepository(EstoqueHistorico);
  }
  private static get configs() {
    return AppDataSource.getRepository(EstoqueConfig);
  }

  static transacao<T>(fn: (manager: EntityManager) => Promise<T>) {
    return AppDataSource.transaction(fn);
  }

  // ---- produtos ----

  static listarProdutos(organizacaoId: string) {
    return this.produtos.find({ where: { organizacaoId }, order: { produto: 'ASC' } });
  }

  static findProduto(organizacaoId: string, id: string) {
    return this.produtos.findOne({ where: { id, organizacaoId } });
  }

  static findProdutosPorIds(organizacaoId: string, ids: string[]) {
    return this.produtos
      .createQueryBuilder('p')
      .where('p.organizacao_id = :organizacaoId', { organizacaoId })
      .andWhere('p.id IN (:...ids)', { ids })
      .getMany();
  }

  static salvarProduto(produto: EstoqueProduto, manager?: EntityManager) {
    return (manager ? manager.getRepository(EstoqueProduto) : this.produtos).save(produto);
  }

  // ---- importações ----

  /** Lista sem o snapshot (`linhas`), que pode ter milhares de linhas. */
  static listarImportacoes(organizacaoId: string) {
    return this.importacoes.find({
      where: { organizacaoId },
      select: ['id', 'nomeArquivo', 'modo', 'totalLinhas', 'totalProdutos', 'resumo', 'restauradaDeId', 'usuarioNome', 'arquivoTamanho', 'criadoEm'],
      order: { criadoEm: 'DESC' },
      take: 100,
    });
  }

  static findImportacao(organizacaoId: string, id: string) {
    return this.importacoes.findOne({ where: { id, organizacaoId } });
  }

  /** Só o necessário pro download do arquivo original (sem as linhas jsonb). */
  static findArquivoOriginal(organizacaoId: string, id: string) {
    return this.importacoes.findOne({ where: { id, organizacaoId }, select: ['id', 'nomeArquivo', 'arquivoOriginal', 'arquivoMime', 'arquivoTamanho'] });
  }

  // ---- histórico ----

  static listarHistorico(organizacaoId: string, tipos: TipoHistoricoEstoque[] | null, limite: number, codigoTrier?: string) {
    const consulta = this.historico
      .createQueryBuilder('h')
      .where('h.organizacao_id = :organizacaoId', { organizacaoId })
      .orderBy('h.criado_em', 'DESC')
      .take(limite);
    if (tipos?.length) consulta.andWhere('h.tipo IN (:...tipos)', { tipos });
    if (codigoTrier) consulta.andWhere('h.codigo_trier = :codigoTrier', { codigoTrier });
    return consulta.getMany();
  }

  static registrarHistorico(entradas: Array<Partial<EstoqueHistorico> & { organizacaoId: string; tipo: TipoHistoricoEstoque }>, manager?: EntityManager) {
    if (!entradas.length) return Promise.resolve([]);
    const repo = manager ? manager.getRepository(EstoqueHistorico) : this.historico;
    return repo.save(repo.create(entradas));
  }

  // ---- configuração ----

  static findConfig(organizacaoId: string) {
    return this.configs.findOne({ where: { organizacaoId } });
  }

  static async salvarConfig(organizacaoId: string, config: ConfigEstoque) {
    const existente = await this.findConfig(organizacaoId);
    return this.configs.save(existente ? Object.assign(existente, { config }) : this.configs.create({ organizacaoId, config }));
  }
}
