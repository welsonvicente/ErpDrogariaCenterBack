import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { atualizarProjetoSchema, criarProjetoSchema, listarProjetosQuerySchema, projetoIdSchema } from '../dtos/projetoCartaz.dto';
import { ProjetoCartazService } from '../services/ProjetoCartazService';

export class ProjetoCartazController {
  static async criar(req: AuthenticatedRequest, res: Response) {
    const { tipo, nome } = criarProjetoSchema.parse(req.body);
    const projeto = await ProjetoCartazService.criar(req.usuario!.organizacaoId, req.usuario!.id, tipo, nome);
    res.status(201).json(projeto);
  }

  static async listar(req: AuthenticatedRequest, res: Response) {
    const { tipo } = listarProjetosQuerySchema.parse(req.query);
    const projetos = await ProjetoCartazService.listar(req.usuario!.organizacaoId, tipo);
    res.status(200).json(projetos);
  }

  static async obter(req: AuthenticatedRequest, res: Response) {
    const id = projetoIdSchema.parse(req.params.id);
    const projeto = await ProjetoCartazService.obterCompleto(id, req.usuario!.organizacaoId);
    res.status(200).json(projeto);
  }

  static async atualizar(req: AuthenticatedRequest, res: Response) {
    const id = projetoIdSchema.parse(req.params.id);
    const dados = atualizarProjetoSchema.parse(req.body);
    const projeto = await ProjetoCartazService.atualizar(id, req.usuario!.organizacaoId, dados);
    res.status(200).json(projeto);
  }

  static async remover(req: AuthenticatedRequest, res: Response) {
    const id = projetoIdSchema.parse(req.params.id);
    await ProjetoCartazService.remover(id, req.usuario!.organizacaoId);
    res.status(204).send();
  }
}
