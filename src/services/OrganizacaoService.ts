import { logger } from '../config/logger';
import { AtualizarOrganizacaoDTO } from '../dtos/organizacao.dto';
import { OrganizacaoRepository } from '../repositories/OrganizacaoRepository';
import { AppError } from '../utils/AppError';

export class OrganizacaoService {
  static async getById(id: string) {
    const organizacao = await OrganizacaoRepository.findById(id);
    if (!organizacao) throw AppError.notFound('Organização', id);
    return organizacao;
  }

  static async atualizar(id: string, data: AtualizarOrganizacaoDTO) {
    await this.getById(id);
    const atualizada = await OrganizacaoRepository.update(id, data);
    logger.info('Organização atualizada', { organizacaoId: id, alteracoes: data });
    return atualizada;
  }
}
