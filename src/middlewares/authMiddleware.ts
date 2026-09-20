import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { PerfilUsuario } from '../models/Usuario';
import { UsuarioRepository } from '../repositories/UsuarioRepository';

/**
 * Qual credencial a pessoa usou pra entrar. Fica no token porque a exigência de
 * PIN forte depende disso: quem tem papel de gestão e entrou por PIN precisa de
 * um PIN à altura do que esse papel abre (ver `requireGerente`). Sem registrar
 * aqui, o middleware não teria como saber — e a proteção sumiria justamente pra
 * quem mais precisa dela.
 */
export type CredencialUsada = 'senha' | 'pin';

export interface AuthenticatedRequest extends Request {
  usuario?: { id: string; organizacaoId: string; perfil: PerfilUsuario; email: string | null; via: CredencialUsada };
}

interface JwtPayload {
  sub: string;
  organizacaoId: string;
  perfil: PerfilUsuario;
  email: string | null;
  /** Ausente em tokens emitidos antes deste campo existir — ver `inferirCredencial`. */
  via?: CredencialUsada;
}

/**
 * Tokens emitidos antes do campo `via` existir continuam válidos por até 12h
 * depois do deploy, então precisam de um valor.
 *
 * Não dá pra assumir 'senha' (deixaria passar sem PIN forte quem entrou por PIN)
 * nem 'pin' (trancaria do lado de fora um ADMIN que entrou por senha e não tem
 * PIN nenhum pra definir). Dá pra deduzir com precisão: até aqui, `login`
 * (e-mail+senha) só atendia quem tem e-mail, e `loginFuncionario` emitia
 * `email: null`. Então a presença do e-mail no payload diz qual porta foi usada.
 */
function inferirCredencial(payload: JwtPayload): CredencialUsada {
  if (payload.via) return payload.via;
  return payload.email ? 'senha' : 'pin';
}

/**
 * Exige um JWT válido de qualquer usuário (ADMIN, GERENTE ou FUNCIONARIO).
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
      via: inferirCredencial(payload),
    };
    next();
  } catch (error) {
    logger.warn('Token inválido ou expirado', { error });
    throw AppError.unauthorized('Token inválido ou expirado.');
  }
}

/** Resultado de `verificarPoderDeGerente` — por que não tem poder de gerente, quando não tem. */
type MotivoSemPoderDeGerente = 'SEM_PAPEL' | 'PIN_FRACO';

/**
 * O que `requireGerente` checa, extraído pra ser reaproveitado por código que
 * precisa saber "essa pessoa tem poder de gerente?" sem interromper a
 * requisição quando a resposta é não (ex.: `ArmazenamentoAppController`, que
 * atende ADMIN/GERENTE e FUNCIONARIO na mesma rota, cada um vendo uma versão
 * diferente do dado, em vez de bloquear quem não é gerente).
 *
 * Sempre consulta o banco (não confia no perfil do JWT) pelo mesmo motivo do
 * `requireGerente`: revogar tem efeito imediato, não só quando o token vence.
 */
export async function verificarPoderDeGerente(
  usuarioDoToken: NonNullable<AuthenticatedRequest['usuario']>,
): Promise<{ podeGerenciar: true; perfilAtual: PerfilUsuario } | { podeGerenciar: false; motivo: MotivoSemPoderDeGerente }> {
  const usuario = await UsuarioRepository.findByIdInOrganizacao(usuarioDoToken.organizacaoId, usuarioDoToken.id);
  if (!usuario || !usuario.ativo || (usuario.perfil !== PerfilUsuario.ADMIN && usuario.perfil !== PerfilUsuario.GERENTE)) {
    return { podeGerenciar: false, motivo: 'SEM_PAPEL' };
  }

  // Tem o papel, mas entrou pela porta rápida do balcão. O PIN de 4 dígitos foi
  // escolhido pra proteger "lançar um gasto em meu nome" — não o financeiro
  // inteiro. Então o painel só abre depois que a pessoa definir um PIN à altura
  // (ela mesma, ver PerfilService.definirPinGestor).
  //
  // A regra é por PAPEL + CREDENCIAL, não por uma flag de exceção: assim ela
  // vale automaticamente pra qualquer gerente ou admin que entre por PIN,
  // inclusive alguém promovido amanhã. Quem entra por senha não passa por aqui.
  if (usuarioDoToken.via === 'pin' && !usuario.pinForte) {
    return { podeGerenciar: false, motivo: 'PIN_FRACO' };
  }

  return { podeGerenciar: true, perfilAtual: usuario.perfil };
}

/**
 * Além de autenticar, exige poder de gerente. Usado nas rotas administrativas
 * (gerenciar funcionários/categorias, ver o dashboard completo de despesas).
 * Deve ser encadeado depois de `authenticate`.
 */
export const requireGerente = asyncHandler(async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const usuarioDoToken = req.usuario;
  if (!usuarioDoToken) {
    throw AppError.unauthorized('Token de autenticação ausente.');
  }

  const resultado = await verificarPoderDeGerente(usuarioDoToken);
  if (!resultado.podeGerenciar) {
    if (resultado.motivo === 'PIN_FRACO') {
      // 428 "Precondition Required" diz ao front exatamente qual passo falta, sem
      // se confundir com "você não tem permissão" (403).
      throw new AppError('Defina um PIN de acesso ao painel antes de continuar.', 428, {
        acao: 'DEFINIR_PIN_GESTOR',
      });
    }
    logger.warn('Acesso de gerente negado: sem papel de gestão ou usuário inativo', { usuarioId: usuarioDoToken.id });
    throw AppError.forbidden('Acesso restrito a administradores e gerentes.');
  }

  // O perfil do banco é a verdade — se alguém foi rebaixado depois do token ser
  // emitido, o resto da requisição enxerga o perfil atual, não o do token.
  req.usuario = { ...usuarioDoToken, perfil: resultado.perfilAtual };
  next();
});

/**
 * Exige papel ADMIN — o dono da conta da organização.
 *
 * Até aqui ADMIN e GERENTE eram idênticos na prática: os dois passavam pelo
 * `requireGerente` e nenhuma rota distinguia um do outro, então "ADMIN" só
 * marcava quem tinha sido o primeiro usuário. Isso deixava um GERENTE gravar
 * código+PIN na conta do ADMIN (e entrar como ele) ou simplesmente excluí-la.
 *
 * Fica reservado ao ADMIN o que afeta a organização inteira ou o próprio quadro
 * de quem administra: dados da organização e gestão de contas ADMIN/GERENTE.
 * Encadear depois de `authenticate`; não depende de `requireGerente`.
 */
export const requireAdmin = asyncHandler(async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const usuarioDoToken = req.usuario;
  if (!usuarioDoToken) {
    throw AppError.unauthorized('Token de autenticação ausente.');
  }

  const usuario = await UsuarioRepository.findByIdInOrganizacao(usuarioDoToken.organizacaoId, usuarioDoToken.id);
  if (!usuario || !usuario.ativo || usuario.perfil !== PerfilUsuario.ADMIN) {
    logger.warn('Acesso restrito a ADMIN negado', { usuarioId: usuarioDoToken.id, perfil: usuario?.perfil });
    throw AppError.forbidden('Essa ação é restrita ao administrador da organização.');
  }

  req.usuario = { ...usuarioDoToken, perfil: usuario.perfil };
  next();
});
