import { AppDataSource } from '../config/data-source';
import { ChavePreferenciaCartaz, PreferenciaCartaz } from '../models/PreferenciaCartaz';

export class PreferenciaCartazRepository {
  private static get repo() {
    return AppDataSource.getRepository(PreferenciaCartaz);
  }

  static listarPorOrganizacao(organizacaoId: string) {
    return this.repo.find({ where: { organizacaoId } });
  }

  /** Cria ou substitui — uma linha por (organização, chave); o índice único barra duplicata mesmo com dois salvamentos simultâneos. */
  static async salvar(organizacaoId: string, chave: ChavePreferenciaCartaz, valor: Record<string, unknown>) {
    const existente = await this.repo.findOne({ where: { organizacaoId, chave } });
    return this.repo.save(existente ? Object.assign(existente, { valor }) : this.repo.create({ organizacaoId, chave, valor }));
  }
}
