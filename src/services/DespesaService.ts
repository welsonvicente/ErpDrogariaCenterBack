import { logger } from '../config/logger';
import { AtualizarDespesaDTO, CriarDespesaDTO, ListarDespesasQueryDTO } from '../dtos/despesa.dto';
import { Despesa } from '../models/Despesa';
import { CategoriaRepository } from '../repositories/CategoriaRepository';
import { DespesaRepository, FiltrosDespesa } from '../repositories/DespesaRepository';
import { AppError } from '../utils/AppError';

/** O relacionamento `usuario` é eager e traz pinHash/senhaHash — nunca deixar isso vazar pela API. */
function sanitizeDespesa(despesa: Despesa) {
  const { pinHash, senhaHash, ...usuarioPublico } = despesa.usuario;
  return { ...despesa, usuario: usuarioPublico };
}

export class DespesaService {
  private static async assertCategoriaExiste(organizacaoId: string, categoriaId?: string) {
    if (!categoriaId) return;
    const categoria = await CategoriaRepository.findById(organizacaoId, categoriaId);
    if (!categoria) throw AppError.notFound('Categoria', categoriaId);
  }

  static async list(organizacaoId: string, query: ListarDespesasQueryDTO) {
    const filtros: FiltrosDespesa = {
      organizacaoId,
      dataInicio: query.dataInicio,
      dataFim: query.dataFim,
      usuarioId: query.usuarioId,
      categoriaId: query.categoriaId,
    };

    const [pagina, total] = await Promise.all([
      DespesaRepository.findPaginated(filtros, query.page, query.pageSize),
      DespesaRepository.sumTotal(filtros),
    ]);

    return { ...pagina, items: pagina.items.map(sanitizeDespesa), valorTotal: total };
  }

  private static async findOrFail(organizacaoId: string, id: string) {
    const despesa = await DespesaRepository.findById(organizacaoId, id);
    if (!despesa) throw AppError.notFound('Despesa', id);
    return despesa;
  }

  static async getById(organizacaoId: string, id: string) {
    const despesa = await this.findOrFail(organizacaoId, id);
    return sanitizeDespesa(despesa);
  }

  /** `usuarioId` vem de quem está autenticado (não do corpo da requisição) — ver despesa.dto.ts. */
  static async create(organizacaoId: string, usuarioId: string, data: CriarDespesaDTO) {
    await this.assertCategoriaExiste(organizacaoId, data.categoriaId);

    const despesa = await DespesaRepository.create({
      organizacaoId,
      data: data.data,
      valor: data.valor.toFixed(2),
      descricao: data.descricao ?? null,
      usuarioId,
      categoriaId: data.categoriaId,
    });

    logger.info('Despesa lançada', {
      despesaId: despesa.id,
      organizacaoId,
      usuarioId,
      categoriaId: data.categoriaId,
      valor: data.valor,
    });

    return this.getById(organizacaoId, despesa.id);
  }

  static async update(organizacaoId: string, id: string, data: AtualizarDespesaDTO) {
    await this.findOrFail(organizacaoId, id);
    await this.assertCategoriaExiste(organizacaoId, data.categoriaId);

    await DespesaRepository.update(id, {
      ...data,
      valor: data.valor !== undefined ? data.valor.toFixed(2) : undefined,
    });

    logger.info('Despesa atualizada', { despesaId: id, organizacaoId, alteracoes: data });
    return this.getById(organizacaoId, id);
  }

  static async remove(organizacaoId: string, id: string) {
    await this.findOrFail(organizacaoId, id);
    await DespesaRepository.remove(id);
    logger.info('Despesa removida', { despesaId: id, organizacaoId });
  }

  /** Estatísticas para os cards/tabela do dashboard do gestor. */
  static async summary(
    organizacaoId: string,
    query: Pick<ListarDespesasQueryDTO, 'dataInicio' | 'dataFim' | 'usuarioId' | 'categoriaId'>,
  ) {
    const filtros: FiltrosDespesa = { organizacaoId, ...query };

    const [valorTotal, porCategoria] = await Promise.all([
      DespesaRepository.sumTotal(filtros),
      DespesaRepository.sumByCategoria(filtros),
    ]);

    return { valorTotal, porCategoria };
  }
}
