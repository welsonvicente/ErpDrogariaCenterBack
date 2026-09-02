import bcrypt from 'bcryptjs';
import { logger } from '../config/logger';
import { AlterarSenhaDTO, AtualizarPerfilDTO } from '../dtos/perfil.dto';
import { Usuario } from '../models/Usuario';
import { UsuarioRepository } from '../repositories/UsuarioRepository';
import { AppError } from '../utils/AppError';

const SALT_ROUNDS = 10;

/** Remove campos sensíveis (hashes) antes de devolver o usuário pela API. */
function sanitize(usuario: Usuario) {
  const { pinHash, senhaHash, ...publico } = usuario;
  return publico;
}

/**
 * Gestão dos "meus dados": o próprio usuário logado editando seu nome/e-mail
 * ou trocando a senha — diferente de UsuarioService, que é o gestor
 * editando OUTROS usuários (funcionários).
 */
export class PerfilService {
  private static async findOrFail(id: string) {
    const usuario = await UsuarioRepository.findById(id);
    if (!usuario) throw AppError.notFound('Usuário', id);
    return usuario;
  }

  static async getById(id: string) {
    return sanitize(await this.findOrFail(id));
  }

  static async atualizar(organizacaoId: string, id: string, data: AtualizarPerfilDTO) {
    await this.findOrFail(id);

    if (data.email) {
      const existente = await UsuarioRepository.findByEmail(organizacaoId, data.email);
      if (existente && existente.id !== id) {
        throw AppError.conflict('Já existe um usuário com esse e-mail nesta organização.');
      }
    }

    const atualizado = await UsuarioRepository.update(id, data);
    logger.info('Perfil atualizado', { usuarioId: id, alteracoes: data });
    return sanitize(atualizado!);
  }

  /** Troca de senha: exige a senha atual — evita que uma sessão roubada troque a senha sem saber a original. */
  static async alterarSenha(id: string, { senhaAtual, novaSenha }: AlterarSenhaDTO) {
    const usuario = await this.findOrFail(id);

    if (!usuario.senhaHash) {
      throw AppError.forbidden('Este usuário não usa login por senha.');
    }

    const senhaConfere = await bcrypt.compare(senhaAtual, usuario.senhaHash);
    if (!senhaConfere) {
      logger.warn('Tentativa de troca de senha com senha atual incorreta', { usuarioId: id });
      throw AppError.unauthorized('Senha atual incorreta.');
    }

    const novoHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
    await UsuarioRepository.update(id, { senhaHash: novoHash });
    logger.info('Senha alterada com sucesso', { usuarioId: id });
  }
}
