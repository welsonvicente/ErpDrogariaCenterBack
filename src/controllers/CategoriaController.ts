import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { atualizarCategoriaSchema, criarCategoriaSchema } from '../dtos/categoria.dto';
import { CategoriaService } from '../services/CategoriaService';

export class CategoriaController {
  static async list(req: AuthenticatedRequest, res: Response) {
    const incluirInativas = req.query.incluirInativas === 'true';
    const categorias = await CategoriaService.list(req.usuario!.organizacaoId, incluirInativas);
    res.status(200).json(categorias);
  }

  static async getById(req: AuthenticatedRequest, res: Response) {
    const categoria = await CategoriaService.getById(req.usuario!.organizacaoId, req.params.id);
    res.status(200).json(categoria);
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    const data = criarCategoriaSchema.parse(req.body);
    const categoria = await CategoriaService.create(req.usuario!.organizacaoId, data);
    res.status(201).json(categoria);
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    const data = atualizarCategoriaSchema.parse(req.body);
    const categoria = await CategoriaService.update(req.usuario!.organizacaoId, req.params.id, data);
    res.status(200).json(categoria);
  }

  static async deactivate(req: AuthenticatedRequest, res: Response) {
    await CategoriaService.deactivate(req.usuario!.organizacaoId, req.params.id);
    res.status(204).send();
  }
}
