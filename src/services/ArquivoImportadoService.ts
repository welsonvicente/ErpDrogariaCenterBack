import { logger } from '../config/logger';
import { ArquivoImportadoRepository } from '../repositories/ArquivoImportadoRepository';
import { AppError } from '../utils/AppError';

export class ArquivoImportadoService {
  static async enviar(organizacaoId: string, nomeOriginal: string, mimeType: string, conteudoBase64: string) {
    const conteudo = Buffer.from(conteudoBase64, 'base64');
    const arquivo = await ArquivoImportadoRepository.criar({
      organizacaoId,
      nomeOriginal,
      mimeType,
      tamanhoBytes: conteudo.length,
      conteudo,
    });
    logger.info('Arquivo importado salvo', { organizacaoId, arquivoId: arquivo.id, tamanhoBytes: conteudo.length });
    return { id: arquivo.id, nomeOriginal: arquivo.nomeOriginal, mimeType: arquivo.mimeType, tamanhoBytes: arquivo.tamanhoBytes, criadoEm: arquivo.criadoEm };
  }

  static listar(organizacaoId: string) {
    return ArquivoImportadoRepository.listarPorOrganizacao(organizacaoId);
  }

  static async baixar(id: string, organizacaoId: string) {
    const arquivo = await ArquivoImportadoRepository.findByIdEOrganizacao(id, organizacaoId);
    if (!arquivo) throw AppError.notFound('Arquivo', id);
    return arquivo;
  }

  static async remover(id: string, organizacaoId: string) {
    const removeu = await ArquivoImportadoRepository.remover(id, organizacaoId);
    if (!removeu) throw AppError.notFound('Arquivo', id);
  }
}
