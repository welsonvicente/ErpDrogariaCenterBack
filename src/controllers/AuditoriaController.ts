import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { AuditoriaService } from '../services/AuditoriaService';

export class AuditoriaController {
  static async list(req: AuthenticatedRequest, res: Response) {
    const registros = await AuditoriaService.list(req.usuario!.organizacaoId);
    res.status(200).json(registros);
  }
}
