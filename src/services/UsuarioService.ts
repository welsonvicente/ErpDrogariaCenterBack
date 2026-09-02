import bcrypt from 'bcryptjs';
import { logger } from '../config/logger';
import { AtualizarFuncionarioDTO, CriarFuncionarioDTO } from '../dtos/usuario.dto';
import { PerfilUsuario, Usuario } from '../models/Usuario';
import { UsuarioRepository } from '../repositories/UsuarioRepository';
import { AppError } from '../utils/AppError';

const SALT_ROUNDS = 10;

/** Remove campos sensíveis (hashes) antes de devolver o usuário pela API. */
function sanitize(usuario: Usuario) {
  const { pinHash, senhaHash, ...publico } = usuario;
  return publico;
}

/** Gestão de funcionários (perfil FUNCIONARIO) dentro de uma organização, feita pelo gestor/admin. */
export class UsuarioService {
  /** Busca interna (traz hashes) — usada só para validações antes de update/deactivate. */
  private static async findOrFail(organizacaoId: string, id: string) {
    const usuario = await UsuarioRepository.findByIdInOrganizacao(organizacaoId, id);
    if (!usuario) throw AppError.notFound('Funcionário', id);
    return usuario;
  }

  static async list(organizacaoId: string, incluirInativos = false) {
    const funcionarios = await UsuarioRepository.findFuncionarios(organizacaoId, incluirInativos);
    return funcionarios.map(sanitize);
  }

  static async getById(organizacaoId: string, id: string) {
    const usuario = await this.findOrFail(organizacaoId, id);
    return sanitize(usuario);
  }

  static async create(organizacaoId: string, data: CriarFuncionarioDTO) {
    const existente = await UsuarioRepository.findByCodigo(organizacaoId, data.codigo);
    if (existente) {
      throw AppError.conflict(`Já existe um funcionário com o código "${data.codigo}".`);
    }

    const pinHash = await bcrypt.hash(data.pin, SALT_ROUNDS);

    const usuario = await UsuarioRepository.create({
      organizacaoId,
      nome: data.nome,
      codigo: data.codigo,
      pinHash,
      icone: data.icone,
      perfil: PerfilUsuario.FUNCIONARIO,
    });

    logger.info('Funcionário criado', { usuarioId: usuario.id, organizacaoId, nome: usuario.nome });
    return sanitize(usuario);
  }

  static async update(organizacaoId: string, id: string, data: AtualizarFuncionarioDTO) {
    await this.findOrFail(organizacaoId, id);

    if (data.codigo) {
      const existente = await UsuarioRepository.findByCodigo(organizacaoId, data.codigo);
      if (existente && existente.id !== id) {
        throw AppError.conflict(`Já existe um funcionário com o código "${data.codigo}".`);
      }
    }

    const { pin, ...resto } = data;
    const alteracoes: Record<string, unknown> = { ...resto };
    if (pin) {
      alteracoes.pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
    }

    const atualizado = await UsuarioRepository.update(id, alteracoes);
    logger.info('Funcionário atualizado', { usuarioId: id, organizacaoId, alteracoes: resto });
    return sanitize(atualizado!);
  }

  /** Inativação lógica (soft delete) — preserva o histórico de despesas já lançadas. */
  static async deactivate(organizacaoId: string, id: string) {
    await this.findOrFail(organizacaoId, id);
    const atualizado = await UsuarioRepository.update(id, { ativo: false });
    logger.info('Funcionário inativado', { usuarioId: id, organizacaoId });
    return sanitize(atualizado!);
  }
}
