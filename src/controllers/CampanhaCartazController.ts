import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { atualizarCampanhaSchema, campanhaIdSchema, criarCampanhaSchema } from '../dtos/campanhaCartaz.dto';
import { CampanhaCartazService } from '../services/CampanhaCartazService';

export class CampanhaCartazController {
  static async criar(req: AuthenticatedRequest, res: Response) {
    const { nome, aparencia } = criarCampanhaSchema.parse(req.body);
    const campanha = await CampanhaCartazService.criar(req.usuario!.organizacaoId, req.usuario!.id, nome, aparencia);
    res.status(201).json(campanha);
  }

  static async listar(req: AuthenticatedRequest, res: Response) {
    res.status(200).json(await CampanhaCartazService.listar(req.usuario!.organizacaoId));
  }

  static async obter(req: AuthenticatedRequest, res: Response) {
    const id = campanhaIdSchema.parse(req.params.id);
    res.status(200).json(await CampanhaCartazService.obter(id, req.usuario!.organizacaoId));
  }

  static async atualizar(req: AuthenticatedRequest, res: Response) {
    const id = campanhaIdSchema.parse(req.params.id);
    const dados = atualizarCampanhaSchema.parse(req.body);
    res.status(200).json(await CampanhaCartazService.atualizar(id, req.usuario!.organizacaoId, dados));
  }

  static async remover(req: AuthenticatedRequest, res: Response) {
    const id = campanhaIdSchema.parse(req.params.id);
    await CampanhaCartazService.remover(id, req.usuario!.organizacaoId);
    res.status(204).send();
  }
}
