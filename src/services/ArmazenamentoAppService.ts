import { logger } from '../config/logger';
import { ArmazenamentoAppRepository } from '../repositories/ArmazenamentoAppRepository';

/** Armazenamento chave-valor compartilhado por organização, usado pelas ferramentas estáticas (public/tools/*.html). */
export class ArmazenamentoAppService {
  static async get(organizacaoId: string, chave: string) {
    const registro = await ArmazenamentoAppRepository.findByChave(organizacaoId, chave);
    return registro?.valor ?? null;
  }

  static async set(organizacaoId: string, chave: string, valor: string) {
    await ArmazenamentoAppRepository.upsert(organizacaoId, chave, valor);
    logger.info('Armazenamento de app atualizado', { organizacaoId, chave, tamanho: valor.length });
  }
}
