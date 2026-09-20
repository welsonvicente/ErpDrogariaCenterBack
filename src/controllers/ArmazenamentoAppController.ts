import { Response } from 'express';
import { AuthenticatedRequest, verificarPoderDeGerente } from '../middlewares/authMiddleware';
import { chaveArmazenamentoSchema, salvarArmazenamentoSchema } from '../dtos/armazenamentoApp.dto';
import { PerfilUsuario } from '../models/Usuario';
import { UsuarioRepository } from '../repositories/UsuarioRepository';
import { ArmazenamentoAppService } from '../services/ArmazenamentoAppService';
import {
  CHAVE_FOLGAS,
  protegerGravacao,
  redigirEstado,
  validarAlteracaoDeFuncionario,
  validarFormatoEstado,
} from '../services/FolgasSigiloService';
import { AppError } from '../utils/AppError';

type NivelAcesso = 'gerente' | 'funcionario';

/** Confere o papel atual no banco; token antigo não mantém acesso revogado. */
async function obterNivelAcesso(req: AuthenticatedRequest): Promise<NivelAcesso> {
  const resultado = await verificarPoderDeGerente(req.usuario!);
  if (resultado.podeGerenciar) return 'gerente';

  if (resultado.motivo === 'PIN_FRACO') {
    throw new AppError('Defina um PIN de acesso ao painel antes de continuar.', 428, {
      acao: 'DEFINIR_PIN_GESTOR',
    });
  }

  const usuario = await UsuarioRepository.findByIdInOrganizacao(req.usuario!.organizacaoId, req.usuario!.id);
  if (!usuario || !usuario.ativo || usuario.perfil !== PerfilUsuario.FUNCIONARIO) {
    throw AppError.forbidden('Seu usuário não tem acesso a este armazenamento.');
  }
  return 'funcionario';
}

function valorVisivel(valor: string, chave: string, nivel: NivelAcesso): string {
  return chave === CHAVE_FOLGAS && nivel === 'funcionario' ? redigirEstado(valor) : valor;
}

export class ArmazenamentoAppController {
  static async get(req: AuthenticatedRequest, res: Response) {
    const chave = chaveArmazenamentoSchema.parse(req.params.chave);
    const nivel = await obterNivelAcesso(req);
    if (chave !== CHAVE_FOLGAS && nivel !== 'gerente') {
      throw AppError.forbidden('Este armazenamento é restrito a administradores e gerentes.');
    }

    const registro = await ArmazenamentoAppService.get(req.usuario!.organizacaoId, chave);
    if (!registro) {
      res.status(200).json({ valor: null, versao: 0 });
      return;
    }

    const valor = valorVisivel(registro.valor, chave, nivel);
    res.status(200).json({ valor, versao: registro.versao });
  }

  /**
   * `versaoEsperada` (opcional) ativa concorrência otimista — ver
   * ArmazenamentoAppService.setComVersao. Em conflito, devolve 409 com o
   * valor/versão atuais pra quem chamou recarregar em vez de tentar nas
   * cegas de novo (e perder a mudança de quem salvou primeiro).
   */
  static async set(req: AuthenticatedRequest, res: Response) {
    const chave = chaveArmazenamentoSchema.parse(req.params.chave);
    const { valor, versaoEsperada } = salvarArmazenamentoSchema.parse(req.body);
    const organizacaoId = req.usuario!.organizacaoId;
    const nivel = await obterNivelAcesso(req);
    if (chave !== CHAVE_FOLGAS && nivel !== 'gerente') {
      throw AppError.forbidden('Este armazenamento é restrito a administradores e gerentes.');
    }

    let valorFinal = valor;
    if (chave === CHAVE_FOLGAS) {
      const registroAtual = await ArmazenamentoAppService.get(organizacaoId, chave);
      const valorAnterior = registroAtual?.valor ?? null;

      if (nivel === 'funcionario') {
        if (versaoEsperada === undefined) {
          throw new AppError('A versão atual é obrigatória para salvar alterações de Folgas.', 400);
        }
        valorFinal = protegerGravacao(valorAnterior, valor);
        const erroPermissao = validarAlteracaoDeFuncionario(valorAnterior, valorFinal, req.usuario!.id);
        if (erroPermissao) throw AppError.forbidden(erroPermissao);
      }

      // Barra aqui um formato claramente quebrado (ex.: `employees` virando
      // uma string por bug no cliente) — sem isso, um valor assim ficaria
      // salvo e quebraria a ferramenta pra QUALQUER pessoa na próxima
      // leitura, só corrigível mexendo direto no banco.
      const erroFormato = validarFormatoEstado(valorFinal);
      if (erroFormato) {
        throw new AppError(erroFormato, 400);
      }
    }

    if (versaoEsperada === undefined) {
      const versao = await ArmazenamentoAppService.set(organizacaoId, chave, valorFinal);
      res.status(200).json({ versao });
      return;
    }

    const resultado = await ArmazenamentoAppService.setComVersao(organizacaoId, chave, valorFinal, versaoEsperada);
    if (resultado.conflito) {
      const atual = resultado.registro;
      res.status(409).json({
        message: 'Alguém mais salvou uma alteração aqui enquanto você editava.',
        valor: atual ? valorVisivel(atual.valor, chave, nivel) : null,
        versao: atual?.versao ?? 0,
      });
      return;
    }

    res.status(200).json({ versao: resultado.registro!.versao });
  }
}
