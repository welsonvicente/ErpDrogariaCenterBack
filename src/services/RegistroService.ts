import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { CATEGORIAS_PADRAO } from '../constants/categoriasPadrao';
import { RegistrarOrganizacaoDTO } from '../dtos/registro.dto';
import { PerfilUsuario } from '../models/Usuario';
import { CategoriaRepository } from '../repositories/CategoriaRepository';
import { OrganizacaoRepository } from '../repositories/OrganizacaoRepository';
import { UsuarioRepository } from '../repositories/UsuarioRepository';
import { AppError } from '../utils/AppError';

const SALT_ROUNDS = 10;

/**
 * Cadastro público de uma organização nova (rota "/cadastro" no front) —
 * cria a organização, o primeiro usuário (ADMIN) e já popula as categorias
 * padrão, pra empresa não começar com a tela de categorias vazia.
 */
export class RegistroService {
  /** Usado pelo front pra avisar em tempo real, antes de enviar o formulário todo. */
  static async slugDisponivel(slug: string) {
    const existente = await OrganizacaoRepository.findBySlug(slug);
    return !existente;
  }

  static async registrarOrganizacao(data: RegistrarOrganizacaoDTO) {
    const slugExistente = await OrganizacaoRepository.findBySlug(data.slug);
    if (slugExistente) {
      throw AppError.conflict(`O endereço "${data.slug}" já está em uso. Escolha outro.`);
    }

    // E-mail de ADMIN/GESTOR é buscado globalmente no login da raiz ("/"),
    // então evitamos duas organizações com o mesmo e-mail de admin — senão
    // o login não saberia pra qual organização mandar o usuário.
    const emailExistente = await UsuarioRepository.findByEmailGlobal(data.email);
    if (emailExistente) {
      throw AppError.conflict('Já existe uma conta com esse e-mail. Faça login em vez de cadastrar.');
    }

    const organizacao = await OrganizacaoRepository.create({
      nome: data.nomeOrganizacao,
      slug: data.slug,
    });

    const senhaHash = await bcrypt.hash(data.senha, SALT_ROUNDS);
    const usuario = await UsuarioRepository.create({
      organizacaoId: organizacao.id,
      nome: data.nomeAdmin,
      email: data.email,
      senhaHash,
      perfil: PerfilUsuario.ADMIN,
    });

    for (const [index, categoria] of CATEGORIAS_PADRAO.entries()) {
      await CategoriaRepository.create({
        organizacaoId: organizacao.id,
        nome: categoria.nome,
        icone: categoria.icone,
        ordem: index,
      });
    }

    logger.info('Nova organização cadastrada', {
      organizacaoId: organizacao.id,
      slug: organizacao.slug,
      usuarioId: usuario.id,
    });

    // Já loga o usuário automaticamente — mesmo formato de resposta do login geral.
    const token = jwt.sign(
      { sub: usuario.id, organizacaoId: organizacao.id, perfil: usuario.perfil, email: usuario.email },
      env.jwt.secret,
      { expiresIn: env.jwt.expiresIn } as jwt.SignOptions,
    );

    return {
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
      organizacaoSlug: organizacao.slug,
    };
  }
}
