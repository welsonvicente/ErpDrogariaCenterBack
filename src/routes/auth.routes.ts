import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Rotas públicas — a organização é identificada pelo slug enviado no corpo
// (o front já sabe o slug porque ele vem como parâmetro da URL, ex.: /drogariacenter/...).
//
// Sem limite de tentativas, por decisão do dono (17/10/2026): o limite por IP
// travou a loja inteira (todo o balcão sai pelo mesmo IP) e ele preferiu nunca
// bloquear. Contrapartida conhecida: PIN de funcionário (4-8 dígitos) fica
// forçável por script. Se for reativar, não conte logins certos e não chaveie
// só por IP.
router.post('/login', asyncHandler(AuthController.login));
router.post('/funcionario-login', asyncHandler(AuthController.loginFuncionario));

export default router;
