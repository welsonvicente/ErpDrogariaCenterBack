import { AppDataSource } from '../config/data-source';
import { Despesa } from '../models/Despesa';

export interface FiltrosDespesa {
  organizacaoId: string;
  dataInicio?: string;
  dataFim?: string;
  usuarioId?: string;
  categoriaId?: string;
}

export class DespesaRepository {
  private static get repo() {
    return AppDataSource.getRepository(Despesa);
  }

  /** Monta o QueryBuilder com os filtros comuns a listagem, contagem e totais. */
  private static baseQuery(filtros: FiltrosDespesa) {
    const qb = this.repo
      .createQueryBuilder('despesa')
      .leftJoinAndSelect('despesa.usuario', 'usuario')
      .leftJoinAndSelect('despesa.categoria', 'categoria')
      .where('despesa.organizacao_id = :organizacaoId', { organizacaoId: filtros.organizacaoId });

    if (filtros.dataInicio) {
      qb.andWhere('despesa.data >= :dataInicio', { dataInicio: filtros.dataInicio });
    }
    if (filtros.dataFim) {
      qb.andWhere('despesa.data <= :dataFim', { dataFim: filtros.dataFim });
    }
    if (filtros.usuarioId) {
      qb.andWhere('despesa.usuario_id = :usuarioId', { usuarioId: filtros.usuarioId });
    }
    if (filtros.categoriaId) {
      qb.andWhere('despesa.categoria_id = :categoriaId', { categoriaId: filtros.categoriaId });
    }

    return qb;
  }

  static async findPaginated(filtros: FiltrosDespesa, page: number, pageSize: number) {
    const [items, total] = await this.baseQuery(filtros)
      .orderBy('despesa.data', 'DESC')
      .addOrderBy('despesa.criadoEm', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /** Todas as despesas que batem com o filtro, sem paginação — usado na exportação (Excel/PDF). */
  static findAll(filtros: FiltrosDespesa) {
    return this.baseQuery(filtros)
      .orderBy('despesa.data', 'DESC')
      .addOrderBy('despesa.criadoEm', 'DESC')
      .take(10000)
      .getMany();
  }

  static findById(organizacaoId: string, id: string) {
    return this.repo.findOne({ where: { id, organizacaoId } });
  }

  static create(data: Partial<Despesa>) {
    const despesa = this.repo.create(data);
    return this.repo.save(despesa);
  }

  static async update(id: string, data: Partial<Despesa>) {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  static remove(id: string) {
    return this.repo.delete(id);
  }

  /** Soma total das despesas que batem com os filtros (usado nos cards de estatística do dashboard). */
  static async sumTotal(filtros: FiltrosDespesa): Promise<number> {
    const { sum } = await this.baseQuery(filtros).select('COALESCE(SUM(despesa.valor), 0)', 'sum').getRawOne();
    return Number(sum);
  }

  /** Total agrupado por categoria (usado no gráfico/tabela de gastos por categoria). */
  static async sumByCategoria(filtros: FiltrosDespesa) {
    return this.baseQuery(filtros)
      .select('categoria.id', 'categoriaId')
      .addSelect('categoria.nome', 'categoriaNome')
      .addSelect('categoria.icone', 'categoriaIcone')
      .addSelect('COALESCE(SUM(despesa.valor), 0)', 'total')
      .groupBy('categoria.id')
      .addGroupBy('categoria.nome')
      .addGroupBy('categoria.icone')
      .orderBy('total', 'DESC')
      .getRawMany();
  }
}
