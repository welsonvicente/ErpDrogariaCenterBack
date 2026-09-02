import { AppDataSource } from '../config/data-source';
import { Organizacao } from '../models/Organizacao';

export class OrganizacaoRepository {
  private static get repo() {
    return AppDataSource.getRepository(Organizacao);
  }

  static findBySlug(slug: string) {
    return this.repo.findOne({ where: { slug } });
  }

  static findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  static create(data: Partial<Organizacao>) {
    const organizacao = this.repo.create(data);
    return this.repo.save(organizacao);
  }

  static async update(id: string, data: Partial<Organizacao>) {
    await this.repo.update(id, data);
    return this.findById(id);
  }
}
