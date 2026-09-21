import { Request, Response } from 'express';
import { atualizarOrganizacaoSchema } from '../dtos/organizacao.dto';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { OrganizacaoService } from '../services/OrganizacaoService';

export class OrganizacaoController {
  /**
   * Confirma, sem expor dados da empresa, se uma URL pública pode abrir a
   * porta de acesso daquela organização. Usado pelo front antes do login por
   * código/PIN para que um endereço inventado não pareça uma organização.
   */
  static async entradaDisponivel(req: Request, res: Response) {
    const slug = req.params.slug?.trim().toLowerCase();
    const organizacao = slug ? await OrganizacaoService.getAtivaPorSlug(slug) : null;
    if (!organizacao) {
      res.status(404).json({ message: 'Organização não encontrada.' });
      return;
    }
    res.status(204).send();
  }

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
