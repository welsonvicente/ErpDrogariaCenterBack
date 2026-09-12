import { logger } from '../config/logger';
import { AtualizarDespesaDTO, CriarDespesaDTO, ListarDespesasQueryDTO } from '../dtos/despesa.dto';
import { Despesa } from '../models/Despesa';
import { CategoriaRepository } from '../repositories/CategoriaRepository';
import { DespesaRepository, FiltrosDespesa } from '../repositories/DespesaRepository';
import { UsuarioRepository } from '../repositories/UsuarioRepository';
import { AppError } from '../utils/AppError';

/** Nome exato da categoria que exige escolher quem recebe o valor (ver `assertBeneficiario`). */
const CATEGORIA_DIARIA_NOME = 'Diária de domingo ou feriado';

/** Remove os hashes sensíveis de um Usuario antes de expô-lo pela API. */
function sanitizeUsuario(usuario: Despesa['usuario']) {
  const { pinHash, senhaHash, ...publico } = usuario;
  return publico;
}

/** Os relacionamentos `usuario`/`beneficiario` são eager e trazem pinHash/senhaHash — nunca deixar isso vazar pela API. */
function sanitizeDespesa(despesa: Despesa) {
  return {
    ...despesa,
    usuario: sanitizeUsuario(despesa.usuario),
    beneficiario: despesa.beneficiario ? sanitizeUsuario(despesa.beneficiario) : null,
  };
}

export class DespesaService {
  private static async assertCategoriaExiste(organizacaoId: string, categoriaId?: string) {
    if (!categoriaId) return null;
    const categoria = await CategoriaRepository.findById(organizacaoId, categoriaId);
    if (!categoria) throw AppError.notFound('Categoria', categoriaId);
    return categoria;
  }

  /** A categoria "Diária de domingo ou feriado" precisa dizer quem recebeu o dinheiro. */
  private static async assertBeneficiario(
    organizacaoId: string,
    categoriaNome: string | undefined,
    beneficiarioId: string | null | undefined,
  ) {
    if (categoriaNome === CATEGORIA_DIARIA_NOME && !beneficiarioId) {
      throw new AppError('Selecione o colaborador que vai receber a diária.', 400);
    }
    if (!beneficiarioId) return;
    const beneficiario = await UsuarioRepository.findByIdInOrganizacao(organizacaoId, beneficiarioId);
    if (!beneficiario) throw AppError.notFound('Colaborador', beneficiarioId);
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

  /**
   * Lançamentos do próprio usuário logado ("meus lançamentos" do funcionário).
   * `usuarioId` é forçado ao dono da sessão — nunca aceito da query, senão um
   * funcionário poderia ver os lançamentos de outro só trocando o parâmetro.
   */
  static async listMinhas(organizacaoId: string, usuarioId: string, query: ListarDespesasQueryDTO) {
    const filtros: FiltrosDespesa = {
      organizacaoId,
      usuarioId,
      dataInicio: query.dataInicio,
      dataFim: query.dataFim,
      categoriaId: query.categoriaId,
    };

    const pagina = await DespesaRepository.findPaginated(filtros, query.page, query.pageSize);
    return { ...pagina, items: pagina.items.map(sanitizeDespesa) };
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
    const categoria = await this.assertCategoriaExiste(organizacaoId, data.categoriaId);
    await this.assertBeneficiario(organizacaoId, categoria?.nome, data.beneficiarioId);

    const despesa = await DespesaRepository.create({
      organizacaoId,
      data: data.data,
      valor: data.valor.toFixed(2),
      formaPagamento: data.formaPagamento,
      descricao: data.descricao ?? null,
      usuarioId,
      categoriaId: data.categoriaId,
      beneficiarioId: data.beneficiarioId ?? null,
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

  /** Todas as despesas que batem com o filtro (sem paginação) — usado na exportação Excel/PDF. */
  static async listParaExportacao(
    organizacaoId: string,
    query: Pick<ListarDespesasQueryDTO, 'dataInicio' | 'dataFim' | 'usuarioId' | 'categoriaId'>,
  ) {
    const filtros: FiltrosDespesa = { organizacaoId, ...query };
    const despesas = await DespesaRepository.findAll(filtros);
    return despesas.map(sanitizeDespesa);
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
