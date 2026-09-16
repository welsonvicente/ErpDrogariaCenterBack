import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { LoginDTO, LoginFuncionarioDTO } from '../dtos/auth.dto';
import { PerfilUsuario } from '../models/Usuario';
import { OrganizacaoRepository } from '../repositories/OrganizacaoRepository';
import { UsuarioRepository } from '../repositories/UsuarioRepository';
import { CredencialUsada } from '../middlewares/authMiddleware';
import { AppError } from '../utils/AppError';

async function resolverOrganizacaoAtiva(slug: string) {
  const organizacao = await OrganizacaoRepository.findBySlug(slug);
  if (!organizacao || !organizacao.ativo) {
    logger.warn('Tentativa de login em organização inexistente/inativa', { slug });
    throw AppError.unauthorized('Organização inválida.');
  }
  return organizacao;
}

function gerarToken(
  payload: { sub: string; organizacaoId: string; perfil: PerfilUsuario; email: string | null; via: CredencialUsada },
  expiresIn: string,
) {
  return jwt.sign(payload, env.jwt.secret, { expiresIn } as jwt.SignOptions);
}

export class AuthService {
  /**
   * Login de ADMIN/GERENTE: e-mail + senha.
   *
   * Dois modos, de acordo com `organizacaoSlug`:
   *  - informado (rota "/:orgSlug/gerente/login"): busca o e-mail só dentro daquela organização.
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

    // Não há checagem de papel aqui de propósito. A porta de entrada é definida
    // pela CREDENCIAL, não pelo papel: quem tem senha entra por senha, quem tem
    // código+PIN entra pelo balcão, e dá pra ter os dois. Antes isto recusava
    // FUNCIONARIO — resquício de quando `perfil` decidia as duas coisas ao mesmo
    // tempo, que é justamente o acoplamento que gerou a flag `podeAcessarGestor`.
    // O que o papel decide é o que a pessoa ENXERGA depois de entrar
    // (ver middlewares/authMiddleware).
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
      { sub: usuario.id, organizacaoId: organizacao.id, perfil: usuario.perfil, email: usuario.email, via: 'senha' },
      env.jwt.expiresIn,
    );

    logger.info('Login de gerente bem-sucedido', { usuarioId: usuario.id, organizacaoId: organizacao.id });

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
      // O código não vai pro log: é metade da credencial, e o log fica em arquivo
      // rotacionado.
      logger.warn('Tentativa de login de funcionário com código inválido', { organizacaoId: organizacao.id });
      throw AppError.unauthorized('Código ou PIN inválidos.');
    }

    const pinConfere = await bcrypt.compare(pin, usuario.pinHash);
    if (!pinConfere) {
      logger.warn('Tentativa de login de funcionário com PIN incorreto', { usuarioId: usuario.id });
      throw AppError.unauthorized('Código ou PIN inválidos.');
    }

    // Sessão de funcionário expira mais rápido: uso típico é em terminal compartilhado no balcão.
    const token = gerarToken(
      { sub: usuario.id, organizacaoId: organizacao.id, perfil: usuario.perfil, email: usuario.email, via: 'pin' },
      '12h',
    );

    logger.info('Login de funcionário bem-sucedido', { usuarioId: usuario.id, organizacaoId: organizacao.id });

    return {
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        icone: usuario.icone,
        perfil: usuario.perfil,
        // O front usa isto pra saber se, ao abrir o painel, precisa pedir que a
        // pessoa defina o PIN dela antes (ver Usuario.pinForte).
        pinForte: usuario.pinForte,
      },
    };
  }
}
