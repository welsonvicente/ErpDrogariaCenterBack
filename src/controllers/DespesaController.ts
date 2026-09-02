import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { atualizarDespesaSchema, criarDespesaSchema, listarDespesasQuerySchema } from '../dtos/despesa.dto';
import { DespesaService } from '../services/DespesaService';

export class DespesaController {
  static async list(req: AuthenticatedRequest, res: Response) {
    const query = listarDespesasQuerySchema.parse(req.query);
    const result = await DespesaService.list(req.usuario!.organizacaoId, query);
    res.status(200).json(result);
  }

  static async summary(req: AuthenticatedRequest, res: Response) {
    const query = listarDespesasQuerySchema.partial().parse(req.query);
    const result = await DespesaService.summary(req.usuario!.organizacaoId, query);
    res.status(200).json(result);
  }

  static async getById(req: AuthenticatedRequest, res: Response) {
    const despesa = await DespesaService.getById(req.usuario!.organizacaoId, req.params.id);
    res.status(200).json(despesa);
  }

  /** Quem lança é sempre o usuário autenticado (req.usuario) — nunca um id vindo do corpo. */
  static async create(req: AuthenticatedRequest, res: Response) {
    const data = criarDespesaSchema.parse(req.body);
    const despesa = await DespesaService.create(req.usuario!.organizacaoId, req.usuario!.id, data);
    res.status(201).json(despesa);
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    const data = atualizarDespesaSchema.parse(req.body);
    const despesa = await DespesaService.update(req.usuario!.organizacaoId, req.params.id, data);
    res.status(200).json(despesa);
  }

  static async remove(req: AuthenticatedRequest, res: Response) {
    await DespesaService.remove(req.usuario!.organizacaoId, req.params.id);
    res.status(204).send();
  }
}
