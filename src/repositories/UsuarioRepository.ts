import { In } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { PerfilUsuario, Usuario } from '../models/Usuario';

/**
 * Camada Repository: encapsula o acesso ao banco (TypeORM) para a entidade
 * Usuario. Toda consulta é sempre escopada por organizacaoId — isolamento
 * entre empresas (multi-tenant) é responsabilidade desta camada, nunca do
 * chamador esquecer de filtrar.
 */
export class UsuarioRepository {
  private static get repo() {
    return AppDataSource.getRepository(Usuario);
  }

  static findByEmail(organizacaoId: string, email: string) {
    return this.repo.findOne({ where: { organizacaoId, email } });
  }

  /**
   * Busca um ADMIN/GESTOR pelo e-mail em QUALQUER organização — usado só na
   * tela de login inicial ("/"), antes de sabermos a qual organização o
   * usuário pertence. Nunca usar isso para FUNCIONARIO (login é por código+PIN).
   */
  static findByEmailGlobal(email: string) {
    return this.repo.findOne({ where: { email, perfil: In([PerfilUsuario.ADMIN, PerfilUsuario.GESTOR]) } });
  }

  static findByCodigo(organizacaoId: string, codigo: string) {
    return this.repo.findOne({ where: { organizacaoId, codigo } });
  }

  static findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  static findByIdInOrganizacao(organizacaoId: string, id: string) {
    return this.repo.findOne({ where: { id, organizacaoId } });
  }

  /** Lista os funcionários (perfil FUNCIONARIO) de uma organização — usado na tela de gestão do gestor. */
  static findFuncionarios(organizacaoId: string, incluirInativos = false) {
    return this.repo.find({
      where: incluirInativos
        ? { organizacaoId, perfil: PerfilUsuario.FUNCIONARIO }
        : { organizacaoId, perfil: PerfilUsuario.FUNCIONARIO, ativo: true },
      order: { nome: 'ASC' },
    });
  }

  static create(data: Partial<Usuario>) {
    const usuario = this.repo.create(data);
    return this.repo.save(usuario);
  }

  static async update(id: string, data: Partial<Usuario>) {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  static remove(id: string) {
    return this.repo.delete(id);
  }
}
