import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { chaveArmazenamentoSchema, elevarArmazenamentoSchema, salvarArmazenamentoSchema } from '../dtos/armazenamentoApp.dto';
import { ArmazenamentoAppService } from '../services/ArmazenamentoAppService';
import {
  CHAVE_FOLGAS,
  HEADER_ELEVACAO,
  emitirTokenElevacao,
  estaElevado,
  protegerGravacao,
  redigirEstado,
  verificarCredencial,
} from '../services/FolgasSigiloService';
import { AppError } from '../utils/AppError';

/** Aplica a ocultação de dado sensível (ver FolgasSigiloService) quando cabível, antes de expor um valor pela API. */
function talvezRedigir(valor: string, chave: string, organizacaoId: string, token: string | undefined) {
  if (chave !== CHAVE_FOLGAS) return valor;
  return estaElevado(token, organizacaoId, chave) ? valor : redigirEstado(valor);
}

export class ArmazenamentoAppController {
  static async get(req: AuthenticatedRequest, res: Response) {
    const chave = chaveArmazenamentoSchema.parse(req.params.chave);
    const registro = await ArmazenamentoAppService.get(req.usuario!.organizacaoId, chave);
    if (!registro) {
      res.status(200).json({ valor: null, versao: 0 });
      return;
    }

    const token = req.header(HEADER_ELEVACAO);
    const valor = talvezRedigir(registro.valor, chave, req.usuario!.organizacaoId, token);
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
    const token = req.header(HEADER_ELEVACAO);

    let valorFinal = valor;
    if (chave === CHAVE_FOLGAS && !estaElevado(token, organizacaoId, chave)) {
      const registroAtual = await ArmazenamentoAppService.get(organizacaoId, chave);
      valorFinal = protegerGravacao(registroAtual?.valor ?? null, valor);
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
        valor: atual ? talvezRedigir(atual.valor, chave, organizacaoId, token) : null,
        versao: atual?.versao ?? 0,
      });
      return;
    }

    res.status(200).json({ versao: resultado.registro!.versao });
  }

  /**
   * "Eleva" o acesso a uma chave sensível, provando conhecer uma senha de
   * papel válida ou ser um funcionário promovido — ver FolgasSigiloService.
   */
  static async elevar(req: AuthenticatedRequest, res: Response) {
    const chave = chaveArmazenamentoSchema.parse(req.params.chave);
    if (chave !== CHAVE_FOLGAS) {
      throw AppError.notFound('Elevação de acesso', chave);
    }

    const credencial = elevarArmazenamentoSchema.parse(req.body);
    const registro = await ArmazenamentoAppService.get(req.usuario!.organizacaoId, chave);

    const papel = verificarCredencial(registro?.valor ?? null, credencial);
    if (!papel) {
      throw AppError.unauthorized('Credencial inválida.');
    }

    const token = emitirTokenElevacao(req.usuario!.organizacaoId, chave);
    res.status(200).json({ token, papel });
  }
}
