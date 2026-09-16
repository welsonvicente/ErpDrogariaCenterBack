import { logger } from '../config/logger';
import { RegistroAuditoriaRepository } from '../repositories/RegistroAuditoriaRepository';

interface AutorAuditoria {
  nome: string;
  email: string | null;
}

/**
 * Trilha de ações sensíveis consultável pelo gerente pela tela (diferente do
 * `logger.info` estruturado, que só existe nos logs do servidor). Escopo
 * deliberadamente pequeno: só as ações que já foram sinalizadas como
 * precisando de rastreabilidade (editar/excluir despesa, conceder/revogar o
 * atalho pro painel do gerente) — não é um framework genérico de auditoria
 * pra toda ação do sistema.
 */
export class AuditoriaService {
  static async registrar(organizacaoId: string, autor: AutorAuditoria, acao: string, detalhes?: string) {
    await RegistroAuditoriaRepository.create({
      organizacaoId,
      usuarioNome: autor.nome,
      usuarioEmail: autor.email,
      acao,
      detalhes: detalhes ?? null,
    });
    logger.info('Ação registrada na auditoria', { organizacaoId, acao, detalhes });
  }

  static list(organizacaoId: string) {
    return RegistroAuditoriaRepository.findRecentes(organizacaoId);
  }
}
