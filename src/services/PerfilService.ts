import bcrypt from 'bcryptjs';
import { logger } from '../config/logger';
import { AlterarSenhaDTO, AtualizarPerfilDTO } from '../dtos/perfil.dto';
import { DefinirPinGestorDTO } from '../dtos/usuario.dto';
import { PerfilUsuario, Usuario } from '../models/Usuario';
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
 * ou trocando a senha — diferente de UsuarioService, que é o gerente
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

  /**
   * O próprio funcionário define o PIN que passa a valer também pro Painel do
   * Gerente, liberando o acesso que o gerente concedeu (ver Usuario.pinForte).
   *
   * Exige o PIN atual: sem isso, quem pegasse o terminal destravado no balcão —
   * com a sessão de outra pessoa aberta — conseguiria escolher um PIN novo e
   * levar embora o acesso ao painel dela. Não existe PIN padrão em lugar nenhum;
   * este é o único caminho de liberação, e o segredo nunca passa pelo gerente.
   */
  static async definirPinGestor(id: string, { pinAtual, novoPin }: DefinirPinGestorDTO) {
    const usuario = await this.findOrFail(id);

    if (usuario.perfil !== PerfilUsuario.ADMIN && usuario.perfil !== PerfilUsuario.GERENTE) {
      throw AppError.forbidden('Este usuário não tem acesso ao Painel do Gerente.');
    }
    if (!usuario.pinHash) {
      throw AppError.forbidden('Este usuário não usa login por PIN.');
    }

    const pinConfere = await bcrypt.compare(pinAtual, usuario.pinHash);
    if (!pinConfere) {
      logger.warn('Tentativa de definir PIN de gerente com PIN atual incorreto', { usuarioId: id });
      throw AppError.unauthorized('PIN atual incorreto.');
    }

    if (await bcrypt.compare(novoPin, usuario.pinHash)) {
      throw new AppError('O novo PIN precisa ser diferente do atual.', 422);
    }

    await UsuarioRepository.update(id, { pinHash: await bcrypt.hash(novoPin, SALT_ROUNDS), pinForte: true });
    logger.info('PIN de acesso ao painel definido pelo próprio usuário', { usuarioId: id });
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
