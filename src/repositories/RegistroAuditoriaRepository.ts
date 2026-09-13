import { AppDataSource } from '../config/data-source';
import { RegistroAuditoria } from '../models/RegistroAuditoria';

export class RegistroAuditoriaRepository {
  private static get repo() {
    return AppDataSource.getRepository(RegistroAuditoria);
  }

  static create(data: Partial<RegistroAuditoria>) {
    const registro = this.repo.create(data);
    return this.repo.save(registro);
  }

  static findRecentes(organizacaoId: string, limit = 200) {
    return this.repo.find({
      where: { organizacaoId },
      order: { criadoEm: 'DESC' },
      take: limit,
    });
  }
}
