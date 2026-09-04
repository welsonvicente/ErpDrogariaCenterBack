import { logger } from '../config/logger';
import { AtualizarCategoriaDTO, CriarCategoriaDTO } from '../dtos/categoria.dto';
import { CategoriaRepository } from '../repositories/CategoriaRepository';
import { DespesaRepository } from '../repositories/DespesaRepository';
import { AppError } from '../utils/AppError';

export class CategoriaService {
  static list(organizacaoId: string, incluirInativas = false) {
    return CategoriaRepository.findAll(organizacaoId, incluirInativas);
  }

  static async getById(organizacaoId: string, id: string) {
    const categoria = await CategoriaRepository.findById(organizacaoId, id);
    if (!categoria) throw AppError.notFound('Categoria', id);
    return categoria;
  }

  static async create(organizacaoId: string, data: CriarCategoriaDTO) {
    const existente = await CategoriaRepository.findByNome(organizacaoId, data.nome);
    if (existente) {
      throw AppError.conflict(`Já existe uma categoria chamada "${data.nome}".`);
    }

    const categoria = await CategoriaRepository.create({ ...data, organizacaoId });
    logger.info('Categoria criada', { categoriaId: categoria.id, organizacaoId, nome: categoria.nome });
    return categoria;
  }

  static async update(organizacaoId: string, id: string, data: AtualizarCategoriaDTO) {
    await this.getById(organizacaoId, id);

    if (data.nome) {
      const existente = await CategoriaRepository.findByNome(organizacaoId, data.nome);
      if (existente && existente.id !== id) {
        throw AppError.conflict(`Já existe uma categoria chamada "${data.nome}".`);
      }
    }

    const atualizada = await CategoriaRepository.update(id, data);
    logger.info('Categoria atualizada', { categoriaId: id, organizacaoId, alteracoes: data });
    return atualizada;
  }

  static async deactivate(organizacaoId: string, id: string) {
    await this.getById(organizacaoId, id);
    const atualizada = await CategoriaRepository.update(id, { ativo: false });
    logger.info('Categoria inativada', { categoriaId: id, organizacaoId });
    return atualizada;
  }

  static async activate(organizacaoId: string, id: string) {
    await this.getById(organizacaoId, id);
    const atualizada = await CategoriaRepository.update(id, { ativo: true });
    logger.info('Categoria ativada', { categoriaId: id, organizacaoId });
    return atualizada;
  }

  static async remove(organizacaoId: string, id: string) {
    await this.getById(organizacaoId, id);

    const totalDespesas = await DespesaRepository.countByCategoria(id);
    if (totalDespesas > 0) {
      throw AppError.conflict(
        'Não é possível excluir: já existem despesas lançadas nesta categoria. Inative a categoria em vez de excluí-la.',
      );
    }

    await CategoriaRepository.remove(id);
    logger.info('Categoria excluída', { categoriaId: id, organizacaoId });
  }
}
