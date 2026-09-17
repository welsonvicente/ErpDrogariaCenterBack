import { logger } from '../config/logger';
import { AtualizarDespesaDTO, CriarDespesaDTO, ListarDespesasQueryDTO } from '../dtos/despesa.dto';
import { Despesa } from '../models/Despesa';
import { CategoriaRepository } from '../repositories/CategoriaRepository';
import { DespesaRepository, FiltrosDespesa } from '../repositories/DespesaRepository';
import { UsuarioRepository } from '../repositories/UsuarioRepository';
import { AppError } from '../utils/AppError';
import { AuditoriaService } from './AuditoriaService';

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

  /** Categorias com `exigeBeneficiario` (ex.: Diária de domingo ou feriado) precisam dizer quem recebeu o dinheiro. */
  private static async assertBeneficiario(
    organizacaoId: string,
    categoriaExigeBeneficiario: boolean | undefined,
    beneficiarioId: string | null | undefined,
  ) {
    if (categoriaExigeBeneficiario && !beneficiarioId) {
      throw new AppError('Selecione o colaborador que vai receber o valor.', 400);
    }
    if (!beneficiarioId) return;
    const beneficiario = await UsuarioRepository.findByIdInOrganizacao(organizacaoId, beneficiarioId);
    if (!beneficiario) throw AppError.notFound('Colaborador', beneficiarioId);
  }

  /**
   * Categorias com `exigeQuantidade` (ex.: Retirada de vitaminas) precisam dizer
   * quantas unidades saíram — o valor é o total, e sozinho não distingue duas
   * caixas de vinte.
   */
  private static assertQuantidade(categoriaExigeQuantidade: boolean | undefined, quantidade: number | null | undefined) {
    if (categoriaExigeQuantidade && !quantidade) {
      throw new AppError('Informe quantas unidades foram retiradas.', 400);
    }
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
    await this.assertBeneficiario(organizacaoId, categoria?.exigeBeneficiario, data.beneficiarioId);
    this.assertQuantidade(categoria?.exigeQuantidade, data.quantidade);

    const despesa = await DespesaRepository.create({
      organizacaoId,
      data: data.data,
      valor: data.valor.toFixed(2),
      formaPagamento: data.formaPagamento,
      descricao: data.descricao ?? null,
      usuarioId,
      categoriaId: data.categoriaId,
      beneficiarioId: data.beneficiarioId ?? null,
      quantidade: data.quantidade ?? null,
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

  /** `autorId` é quem está autenticado fazendo a edição — usado só pra registrar na auditoria. */
  static async update(organizacaoId: string, id: string, autorId: string, data: AtualizarDespesaDTO) {
    const existente = await this.findOrFail(organizacaoId, id);
    const categoria = await this.assertCategoriaExiste(organizacaoId, data.categoriaId);

    // Resolve pro valor FINAL (o que já estava, a menos que essa edição
    // esteja mudando) — sem isso, trocar só a categoria pra uma que exige
    // beneficiário numa edição passava sem exigir nada, diferente do que já
    // acontece ao lançar o gasto pela primeira vez.
    const categoriaExigeBeneficiarioFinal = categoria?.exigeBeneficiario ?? existente.categoria.exigeBeneficiario;
    const beneficiarioIdFinal = 'beneficiarioId' in data ? data.beneficiarioId : existente.beneficiarioId;
    await this.assertBeneficiario(organizacaoId, categoriaExigeBeneficiarioFinal, beneficiarioIdFinal);

    // Mesma resolução pro valor final, pelo mesmo motivo.
    const categoriaExigeQuantidadeFinal = categoria?.exigeQuantidade ?? existente.categoria.exigeQuantidade;
    const quantidadeFinal = 'quantidade' in data ? data.quantidade : existente.quantidade;
    this.assertQuantidade(categoriaExigeQuantidadeFinal, quantidadeFinal);

    await DespesaRepository.update(id, {
      ...data,
      valor: data.valor !== undefined ? data.valor.toFixed(2) : undefined,
    });

    logger.info('Despesa atualizada', { despesaId: id, organizacaoId, alteracoes: data });
    const autor = await UsuarioRepository.findById(autorId);
    await AuditoriaService.registrar(
      organizacaoId,
      { nome: autor?.nome ?? '—', email: autor?.email ?? null },
      'despesa.editada',
      `${existente.usuario.nome} — ${existente.categoria.nome} — R$ ${existente.valor}`,
    );

    return this.getById(organizacaoId, id);
  }

  /** `autorId` é quem está autenticado fazendo a exclusão — usado só pra registrar na auditoria. */
  static async remove(organizacaoId: string, id: string, autorId: string) {
    const despesa = await this.findOrFail(organizacaoId, id);
    await DespesaRepository.remove(id);
    logger.info('Despesa removida', { despesaId: id, organizacaoId });

    const autor = await UsuarioRepository.findById(autorId);
    await AuditoriaService.registrar(
      organizacaoId,
      { nome: autor?.nome ?? '—', email: autor?.email ?? null },
      'despesa.excluida',
      `${despesa.usuario.nome} — ${despesa.categoria.nome} — R$ ${despesa.valor}`,
    );
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

  /** Estatísticas para os cards/tabela do dashboard do gerente. */
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
