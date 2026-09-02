import { Request, Response } from 'express';
import { loginFuncionarioSchema, loginSchema } from '../dtos/auth.dto';
import { AuthService } from '../services/AuthService';

/**
 * Camada Controller: só cuida de HTTP (ler request, validar formato de
 * entrada via schema, chamar o Service, devolver a resposta). Nenhuma regra
 * de negócio deve morar aqui.
 */
export class AuthController {
  /** Login de ADMIN/GESTOR. */
  static async login(req: Request, res: Response) {
    const data = loginSchema.parse(req.body);
    const result = await AuthService.login(data);
    res.status(200).json(result);
  }

  /** Login rápido de FUNCIONARIO (código + PIN) — rota pública, organização vem do slug na URL do front. */
  static async loginFuncionario(req: Request, res: Response) {
    const data = loginFuncionarioSchema.parse(req.body);
    const result = await AuthService.loginFuncionario(data);
    res.status(200).json(result);
  }
}
