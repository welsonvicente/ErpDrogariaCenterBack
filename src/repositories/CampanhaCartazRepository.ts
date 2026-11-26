import { AppDataSource } from '../config/data-source';
import { CampanhaCartaz } from '../models/CampanhaCartaz';

export class CampanhaCartazRepository {
  private static get repo() {
    return AppDataSource.getRepository(CampanhaCartaz);
  }

  static criar(dados: { organizacaoId: string; criadoPorId: string | null; nome: string; aparencia: Record<string, unknown> }) {
    return this.repo.save(this.repo.create({ ...dados, folhaOferta: {} }));
  }

  /** Lista sem `folhaOferta` (pode ser grande, com o lote inteiro) — só o necessário pra escolher a campanha. */
  static listarPorOrganizacao(organizacaoId: string) {
    return this.repo.find({
      where: { organizacaoId },
      relations: { criadoPor: true },
      select: { id: true, nome: true, criadoPorId: true, criadoEm: true, atualizadoEm: true, criadoPor: { id: true, nome: true } },
      order: { atualizadoEm: 'DESC' },
    });
  }

  static findByIdEOrganizacao(id: string, organizacaoId: string) {
    return this.repo.findOne({
      where: { id, organizacaoId },
      relations: { criadoPor: true },
      select: { id: true, nome: true, folhaOferta: true, aparencia: true, criadoPorId: true, criadoEm: true, atualizadoEm: true, criadoPor: { id: true, nome: true } },
    });
  }

  static async existe(id: string, organizacaoId: string) {
    return (await this.repo.count({ where: { id, organizacaoId } })) > 0;
  }

  static salvar(campanha: CampanhaCartaz) {
    return this.repo.save(campanha);
  }

  static async remover(id: string, organizacaoId: string) {
    const resultado = await this.repo.delete({ id, organizacaoId });
    return (resultado.affected ?? 0) > 0;
  }
}
