import { AppDataSource } from '../config/data-source';
import { ProjetoCartaz, TipoProjetoCartaz } from '../models/ProjetoCartaz';

export class ProjetoCartazRepository {
  private static get repo() {
    return AppDataSource.getRepository(ProjetoCartaz);
  }

  static criar(dados: { organizacaoId: string; criadoPorId: string | null; tipo: TipoProjetoCartaz; nome: string }) {
    return this.repo.save(this.repo.create({ ...dados, estadoEditor: {} }));
  }

  /** Lista sem `estadoEditor` (pode ser um JSON grande) — só o necessário pra mostrar a lista de projetos. */
  static listarPorOrganizacao(organizacaoId: string, tipo?: TipoProjetoCartaz) {
    return this.repo.find({
      where: { organizacaoId, ...(tipo ? { tipo } : {}) },
      relations: { criadoPor: true },
      select: {
        id: true,
        tipo: true,
        nome: true,
        criadoPorId: true,
        criadoEm: true,
        atualizadoEm: true,
        criadoPor: { id: true, nome: true },
      },
      order: { atualizadoEm: 'DESC' },
    });
  }

  /** Carrega o projeto completo (com `estadoEditor`) — usado ao abrir um projeto pra editar. */
  static findByIdEOrganizacao(id: string, organizacaoId: string) {
    return this.repo.findOne({
      where: { id, organizacaoId },
      relations: { criadoPor: true },
      select: {
        id: true,
        tipo: true,
        nome: true,
        estadoEditor: true,
        criadoPorId: true,
        criadoEm: true,
        atualizadoEm: true,
        criadoPor: { id: true, nome: true },
      },
    });
  }

  static salvar(projeto: ProjetoCartaz) {
    return this.repo.save(projeto);
  }

  static async remover(id: string, organizacaoId: string) {
    const resultado = await this.repo.delete({ id, organizacaoId });
    return (resultado.affected ?? 0) > 0;
  }
}
