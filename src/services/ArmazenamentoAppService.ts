import { logger } from '../config/logger';
import { ArmazenamentoAppRepository } from '../repositories/ArmazenamentoAppRepository';

/** Armazenamento chave-valor compartilhado por organização, usado pelas ferramentas estáticas (public/tools/*.html). */
export class ArmazenamentoAppService {
  static async get(organizacaoId: string, chave: string) {
    const registro = await ArmazenamentoAppRepository.findByChave(organizacaoId, chave);
    if (!registro) return null;
    return { valor: registro.valor, versao: registro.versao };
  }

  /** Grava sem controle de concorrência — mantido pra quem ainda não manda `versaoEsperada`. */
  static async set(organizacaoId: string, chave: string, valor: string) {
    const registro = await ArmazenamentoAppRepository.upsert(organizacaoId, chave, valor);
    logger.info('Armazenamento de app atualizado', { organizacaoId, chave, tamanho: valor.length });
    return registro.versao;
  }

  /**
   * Grava só se `versaoEsperada` ainda for a versão atual (concorrência
   * otimista — ver ArmazenamentoAppRepository.atualizarComVersao). Em caso
   * de conflito, devolve o registro atual pra quem chamou decidir o que
   * fazer (hoje: avisar a pessoa e recarregar em vez de perder a mudança
   * dela silenciosamente).
   */
  static async setComVersao(organizacaoId: string, chave: string, valor: string, versaoEsperada: number) {
    const resultado = await ArmazenamentoAppRepository.atualizarComVersao(organizacaoId, chave, valor, versaoEsperada);
    if (resultado.conflito) {
      logger.warn('Conflito de concorrência no armazenamento de app', { organizacaoId, chave, versaoEsperada });
    } else {
      logger.info('Armazenamento de app atualizado', { organizacaoId, chave, tamanho: valor.length, versao: resultado.registro?.versao });
    }
    return resultado;
  }
}
