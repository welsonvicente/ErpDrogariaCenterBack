import { Response } from 'express';
import { atualizarOrganizacaoSchema } from '../dtos/organizacao.dto';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { OrganizacaoService } from '../services/OrganizacaoService';

export class OrganizacaoController {
  static async getAtual(req: AuthenticatedRequest, res: Response) {
    const organizacao = await OrganizacaoService.getById(req.usuario!.organizacaoId);
    res.status(200).json(organizacao);
  }

  static async atualizar(req: AuthenticatedRequest, res: Response) {
    const data = atualizarOrganizacaoSchema.parse(req.body);
    const organizacao = await OrganizacaoService.atualizar(req.usuario!.organizacaoId, data);
    res.status(200).json(organizacao);
  }
}
