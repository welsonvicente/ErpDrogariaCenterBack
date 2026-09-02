import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { atualizarFuncionarioSchema, criarFuncionarioSchema } from '../dtos/usuario.dto';
import { UsuarioService } from '../services/UsuarioService';

/** Gestão de funcionários — todas as rotas exigem gestor autenticado (ver routes/usuario.routes.ts). */
export class UsuarioController {
  static async list(req: AuthenticatedRequest, res: Response) {
    const incluirInativos = req.query.incluirInativos === 'true';
    const funcionarios = await UsuarioService.list(req.usuario!.organizacaoId, incluirInativos);
    res.status(200).json(funcionarios);
  }

  static async getById(req: AuthenticatedRequest, res: Response) {
    const funcionario = await UsuarioService.getById(req.usuario!.organizacaoId, req.params.id);
    res.status(200).json(funcionario);
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    const data = criarFuncionarioSchema.parse(req.body);
    const funcionario = await UsuarioService.create(req.usuario!.organizacaoId, data);
    res.status(201).json(funcionario);
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    const data = atualizarFuncionarioSchema.parse(req.body);
    const funcionario = await UsuarioService.update(req.usuario!.organizacaoId, req.params.id, data);
    res.status(200).json(funcionario);
  }

  static async deactivate(req: AuthenticatedRequest, res: Response) {
    await UsuarioService.deactivate(req.usuario!.organizacaoId, req.params.id);
    res.status(204).send();
  }
}
