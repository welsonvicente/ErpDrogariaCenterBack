import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { chaveArmazenamentoSchema, salvarArmazenamentoSchema } from '../dtos/armazenamentoApp.dto';
import { ArmazenamentoAppService } from '../services/ArmazenamentoAppService';

export class ArmazenamentoAppController {
  static async get(req: AuthenticatedRequest, res: Response) {
    const chave = chaveArmazenamentoSchema.parse(req.params.chave);
    const valor = await ArmazenamentoAppService.get(req.usuario!.organizacaoId, chave);
    res.status(200).json({ valor });
  }

  static async set(req: AuthenticatedRequest, res: Response) {
    const chave = chaveArmazenamentoSchema.parse(req.params.chave);
    const { valor } = salvarArmazenamentoSchema.parse(req.body);
    await ArmazenamentoAppService.set(req.usuario!.organizacaoId, chave, valor);
    res.status(204).send();
  }
}
