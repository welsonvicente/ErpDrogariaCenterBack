import { Response } from 'express';
import { alterarSenhaSchema, atualizarPerfilSchema } from '../dtos/perfil.dto';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { PerfilService } from '../services/PerfilService';

/** "Meus dados": o próprio usuário logado vendo/editando seu perfil e trocando a senha. */
export class PerfilController {
  static async getMe(req: AuthenticatedRequest, res: Response) {
    const perfil = await PerfilService.getById(req.usuario!.id);
    res.status(200).json(perfil);
  }

  static async atualizar(req: AuthenticatedRequest, res: Response) {
    const data = atualizarPerfilSchema.parse(req.body);
    const perfil = await PerfilService.atualizar(req.usuario!.organizacaoId, req.usuario!.id, data);
    res.status(200).json(perfil);
  }

  static async alterarSenha(req: AuthenticatedRequest, res: Response) {
    const data = alterarSenhaSchema.parse(req.body);
    await PerfilService.alterarSenha(req.usuario!.id, data);
    res.status(204).send();
  }
}
