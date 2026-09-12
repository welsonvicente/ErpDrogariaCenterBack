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

export class ArmazenamentoAppController {
  static async get(req: AuthenticatedRequest, res: Response) {
    const chave = chaveArmazenamentoSchema.parse(req.params.chave);
    const valor = await ArmazenamentoAppService.get(req.usuario!.organizacaoId, chave);

    if (valor && chave === CHAVE_FOLGAS) {
      const token = req.header(HEADER_ELEVACAO);
      if (!estaElevado(token, req.usuario!.organizacaoId, chave)) {
        res.status(200).json({ valor: redigirEstado(valor) });
        return;
      }
    }

    res.status(200).json({ valor });
  }

  static async set(req: AuthenticatedRequest, res: Response) {
    const chave = chaveArmazenamentoSchema.parse(req.params.chave);
    const { valor } = salvarArmazenamentoSchema.parse(req.body);

    let valorFinal = valor;
    if (chave === CHAVE_FOLGAS) {
      const token = req.header(HEADER_ELEVACAO);
      if (!estaElevado(token, req.usuario!.organizacaoId, chave)) {
        const valorAnterior = await ArmazenamentoAppService.get(req.usuario!.organizacaoId, chave);
        valorFinal = protegerGravacao(valorAnterior, valor);
      }
    }

    await ArmazenamentoAppService.set(req.usuario!.organizacaoId, chave, valorFinal);
    res.status(204).send();
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
    const valor = await ArmazenamentoAppService.get(req.usuario!.organizacaoId, chave);

    const papel = verificarCredencial(valor, credencial);
    if (!papel) {
      throw AppError.unauthorized('Credencial inválida.');
    }

    const token = emitirTokenElevacao(req.usuario!.organizacaoId, chave);
    res.status(200).json({ token, papel });
  }
}
