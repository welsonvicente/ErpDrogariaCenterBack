import { AppDataSource } from '../config/data-source';
import { ArmazenamentoApp } from '../models/ArmazenamentoApp';

export class ArmazenamentoAppRepository {
  private static get repo() {
    return AppDataSource.getRepository(ArmazenamentoApp);
  }

  static findByChave(organizacaoId: string, chave: string) {
    return this.repo.findOne({ where: { organizacaoId, chave } });
  }

  static async upsert(organizacaoId: string, chave: string, valor: string) {
    const existente = await this.findByChave(organizacaoId, chave);
    if (existente) {
      existente.valor = valor;
      return this.repo.save(existente);
    }
    return this.repo.save(this.repo.create({ organizacaoId, chave, valor }));
  }
}
