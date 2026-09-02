import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { LoginDTO, LoginFuncionarioDTO } from '../dtos/auth.dto';
import { PerfilUsuario } from '../models/Usuario';
import { OrganizacaoRepository } from '../repositories/OrganizacaoRepository';
import { UsuarioRepository } from '../repositories/UsuarioRepository';
import { AppError } from '../utils/AppError';

async function resolverOrganizacaoAtiva(slug: string) {
  const organizacao = await OrganizacaoRepository.findBySlug(slug);
  if (!organizacao || !organizacao.ativo) {
    logger.warn('Tentativa de login em organização inexistente/inativa', { slug });
    throw AppError.unauthorized('Organização inválida.');
  }
  return organizacao;
}

function gerarToken(payload: { sub: string; organizacaoId: string; perfil: PerfilUsuario; email: string | null }, expiresIn: string) {
  return jwt.sign(payload, env.jwt.secret, { expiresIn } as jwt.SignOptions);
}

export class AuthService {
  /**
   * Login de ADMIN/GESTOR: e-mail + senha.
   *
   * Dois modos, de acordo com `organizacaoSlug`:
   *  - informado (rota "/:orgSlug/gestor/login"): busca o e-mail só dentro daquela organização.
   *  - ausente (tela inicial "/"): busca o e-mail em todas as organizações — é assim que o
   *    usuário "descobre" a que empresa ele pertence sem precisar saber o slug de antemão.
   */
  static async login({ organizacaoSlug, email, senha }: LoginDTO) {
    const usuario = organizacaoSlug
      ? await UsuarioRepository.findByEmail((await resolverOrganizacaoAtiva(organizacaoSlug)).id, email)
      : await UsuarioRepository.findByEmailGlobal(email);

    if (!usuario || !usuario.ativo || !usuario.senhaHash) {
      logger.warn('Tentativa de login com e-mail inexistente/inativo', { organizacaoSlug, email });
      throw AppError.unauthorized('E-mail ou senha inválidos.');
    }

    if (usuario.perfil === PerfilUsuario.FUNCIONARIO) {
      throw AppError.forbidden('Funcionários devem entrar pela tela de código + PIN.');
    }

    const senhaConfere = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaConfere) {
      logger.warn('Tentativa de login com senha incorreta', { usuarioId: usuario.id });
      throw AppError.unauthorized('E-mail ou senha inválidos.');
    }

    const organizacao = await OrganizacaoRepository.findById(usuario.organizacaoId);
    if (!organizacao || !organizacao.ativo) {
      throw AppError.unauthorized('Organização inválida.');
    }

    const token = gerarToken(
      { sub: usuario.id, organizacaoId: organizacao.id, perfil: usuario.perfil, email: usuario.email },
      env.jwt.expiresIn,
    );

    logger.info('Login de gestor bem-sucedido', { usuarioId: usuario.id, organizacaoId: organizacao.id });

    return {
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
      organizacaoSlug: organizacao.slug,
    };
  }

  /** Login rápido de FUNCIONARIO: código + PIN, escopado pela organização. */
  static async loginFuncionario({ organizacaoSlug, codigo, pin }: LoginFuncionarioDTO) {
    const organizacao = await resolverOrganizacaoAtiva(organizacaoSlug);

    const usuario = await UsuarioRepository.findByCodigo(organizacao.id, codigo);
    if (!usuario || !usuario.ativo || !usuario.pinHash) {
      logger.warn('Tentativa de login de funcionário com código inválido', { organizacaoId: organizacao.id, codigo });
      throw AppError.unauthorized('Código ou PIN inválidos.');
    }

    const pinConfere = await bcrypt.compare(pin, usuario.pinHash);
    if (!pinConfere) {
      logger.warn('Tentativa de login de funcionário com PIN incorreto', { usuarioId: usuario.id });
      throw AppError.unauthorized('Código ou PIN inválidos.');
    }

    // Sessão de funcionário expira mais rápido: uso típico é em terminal compartilhado no balcão.
    const token = gerarToken(
      { sub: usuario.id, organizacaoId: organizacao.id, perfil: usuario.perfil, email: usuario.email },
      '12h',
    );

    logger.info('Login de funcionário bem-sucedido', { usuarioId: usuario.id, organizacaoId: organizacao.id });

    return {
      token,
      usuario: { id: usuario.id, nome: usuario.nome, icone: usuario.icone, perfil: usuario.perfil },
    };
  }
}
