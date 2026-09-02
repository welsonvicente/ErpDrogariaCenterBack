import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';
import { PerfilUsuario } from '../models/Usuario';

export interface AuthenticatedRequest extends Request {
  usuario?: { id: string; organizacaoId: string; perfil: PerfilUsuario; email: string | null };
}

interface JwtPayload {
  sub: string;
  organizacaoId: string;
  perfil: PerfilUsuario;
  email: string | null;
}

/**
 * Exige um JWT válido de qualquer usuário (ADMIN, GESTOR ou FUNCIONARIO).
 * Usado em rotas que qualquer usuário autenticado pode acessar (ex.: lançar
 * uma despesa, listar categorias).
 */
export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw AppError.unauthorized('Token de autenticação ausente.');
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, env.jwt.secret) as JwtPayload;
    req.usuario = {
      id: payload.sub,
      organizacaoId: payload.organizacaoId,
      perfil: payload.perfil,
      email: payload.email,
    };
    next();
  } catch (error) {
    logger.warn('Token inválido ou expirado', { error });
    throw AppError.unauthorized('Token inválido ou expirado.');
  }
}

/**
 * Além de autenticar, exige que o usuário seja ADMIN ou GESTOR. Usado nas
 * rotas administrativas (gerenciar funcionários/categorias, ver o dashboard
 * completo de despesas). Deve ser encadeado depois de `authenticate`.
 */
export function requireGestor(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const perfil = req.usuario?.perfil;
  if (perfil !== PerfilUsuario.ADMIN && perfil !== PerfilUsuario.GESTOR) {
    throw AppError.forbidden('Acesso restrito a administradores e gestores.');
  }
  next();
}
