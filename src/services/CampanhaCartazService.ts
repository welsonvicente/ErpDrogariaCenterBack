import { AppDataSource } from '../config/data-source';
import { ProjetoCartaz } from '../models/ProjetoCartaz';
import { CampanhaCartazRepository } from '../repositories/CampanhaCartazRepository';
import { AppError } from '../utils/AppError';
import { ProjetoCartazService } from './ProjetoCartazService';

export class CampanhaCartazService {
  /** `aparencia`: o front manda uma cópia da campanha aberta (sem os fundos) pra não começar do zero. */
  static criar(organizacaoId: string, usuarioId: string, nome: string, aparencia: Record<string, unknown> = {}) {
    return CampanhaCartazRepository.criar({ organizacaoId, criadoPorId: usuarioId, nome, aparencia });
  }

  /**
   * Campanhas com um resumo pra escolher: quantos projetos de cada tipo e a última
   * atividade (a campanha ou qualquer projeto dela) — a mais mexida aparece primeiro.
   */
  static async listar(organizacaoId: string) {
    const campanhas = await CampanhaCartazRepository.listarPorOrganizacao(organizacaoId);
    const projetos = await AppDataSource.getRepository(ProjetoCartaz).find({
      where: { organizacaoId },
      select: { id: true, campanhaId: true, tipo: true, atualizadoEm: true },
    });
    const resumo = campanhas.map((c) => {
      const deles = projetos.filter((p) => p.campanhaId === c.id);
      const ultima = deles.reduce((maior, p) => (p.atualizadoEm > maior ? p.atualizadoEm : maior), c.atualizadoEm);
      const contar = (tipo: string) => deles.filter((p) => p.tipo === tipo).length;
      return { ...c, ultimaAtividade: ultima, projetos: { story: contar('story'), panfleto: contar('panfleto'), planilha: contar('planilha') } };
    });
    return resumo.sort((a, b) => b.ultimaAtividade.getTime() - a.ultimaAtividade.getTime());
  }

  static async obter(id: string, organizacaoId: string) {
    const campanha = await CampanhaCartazRepository.findByIdEOrganizacao(id, organizacaoId);
    if (!campanha) throw AppError.notFound('Campanha', id);
    return campanha;
  }

  /** `aparencia` vem por partes (só a chave que mudou) — junta com o que já está salvo. */
  static async atualizar(id: string, organizacaoId: string, dados: { nome?: string; folhaOferta?: Record<string, unknown>; aparencia?: Record<string, unknown> }) {
    const campanha = await CampanhaCartazService.obter(id, organizacaoId);
    if (dados.nome !== undefined) campanha.nome = dados.nome;
    if (dados.folhaOferta !== undefined) campanha.folhaOferta = dados.folhaOferta;
    if (dados.aparencia !== undefined) campanha.aparencia = { ...campanha.aparencia, ...dados.aparencia };
    return CampanhaCartazRepository.salvar(campanha);
  }

  /** Apaga a campanha e os projetos dela (com as fotos no R2) — só quando a pessoa confirma na tela. */
  static async remover(id: string, organizacaoId: string) {
    await CampanhaCartazService.obter(id, organizacaoId);
    const projetos = await AppDataSource.getRepository(ProjetoCartaz).find({ where: { organizacaoId, campanhaId: id }, select: { id: true } });
    for (const projeto of projetos) {
      // eslint-disable-next-line no-await-in-loop
      await ProjetoCartazService.remover(projeto.id, organizacaoId);
    }
    await CampanhaCartazRepository.remover(id, organizacaoId);
  }
}
