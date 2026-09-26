import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { chavePreferenciaSchema, salvarPreferenciaSchema } from '../dtos/preferenciaCartaz.dto';
import { PreferenciaCartazService } from '../services/PreferenciaCartazService';

export class PreferenciaCartazController {
  static async listar(req: AuthenticatedRequest, res: Response) {
    const preferencias = await PreferenciaCartazService.listar(req.usuario!.organizacaoId);
    res.status(200).json(preferencias);
  }

  static async salvar(req: AuthenticatedRequest, res: Response) {
    const chave = chavePreferenciaSchema.parse(req.params.chave);
    const { valor } = salvarPreferenciaSchema.parse(req.body);
    const salva = await PreferenciaCartazService.salvar(req.usuario!.organizacaoId, chave, valor);
    res.status(200).json(salva);
  }
}
