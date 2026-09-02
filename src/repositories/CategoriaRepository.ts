import { AppDataSource } from '../config/data-source';
import { Categoria } from '../models/Categoria';

export class CategoriaRepository {
  private static get repo() {
    return AppDataSource.getRepository(Categoria);
  }

  static findAll(organizacaoId: string, incluirInativas = false) {
    return this.repo.find({
      where: incluirInativas ? { organizacaoId } : { organizacaoId, ativo: true },
      order: { ordem: 'ASC', nome: 'ASC' },
    });
  }

  static findById(organizacaoId: string, id: string) {
    return this.repo.findOne({ where: { id, organizacaoId } });
  }

  static findByNome(organizacaoId: string, nome: string) {
    return this.repo.findOne({ where: { organizacaoId, nome } });
  }

  static create(data: Partial<Categoria>) {
    const categoria = this.repo.create(data);
    return this.repo.save(categoria);
  }

  static async update(id: string, data: Partial<Categoria>) {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  static remove(id: string) {
    return this.repo.delete(id);
  }
}
