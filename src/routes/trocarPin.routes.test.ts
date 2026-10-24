import request from 'supertest';
import { createApp } from '../app';
import { _resetPinGestorRateLimit } from '../middlewares/rateLimitMiddleware';
import { PerfilUsuario } from '../models/Usuario';
import { resetDb } from '../tests/helpers/db';
import { criarFuncionario, criarOrganizacao, gerarToken } from '../tests/helpers/factory';

/** PUT /api/perfil/pin — o próprio usuário troca o PIN do login rápido (o PIN de fábrica dos testes é 1234). */
describe('PUT /api/perfil/pin — trocar o próprio PIN', () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDb();
    await _resetPinGestorRateLimit();
  });

  async function cenario(perfil = PerfilUsuario.FUNCIONARIO) {
    const org = await criarOrganizacao({ slug: `org-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
    const funcionario = await criarFuncionario(org.id, { codigo: 'ana', perfil, pinForte: perfil !== PerfilUsuario.FUNCIONARIO });
    return { org, token: gerarToken(funcionario) };
  }

  const trocar = (token: string, pinAtual: string, novoPin: string) =>
    request(app).put('/api/perfil/pin').set('Authorization', `Bearer ${token}`).send({ pinAtual, novoPin });
  const login = (slug: string, pin: string) =>
    request(app).post('/api/auth/funcionario-login').send({ organizacaoSlug: slug, codigo: 'ana', pin });

  it('funcionário troca o PIN: o novo entra e o antigo deixa de entrar', async () => {
    const { org, token } = await cenario();
    expect((await trocar(token, '1234', '5678')).status).toBe(204);
    expect((await login(org.slug, '5678')).status).toBe(200);
    expect((await login(org.slug, '1234')).status).toBe(401);
  });

  it('PIN atual errado não troca (403) e o PIN de antes continua valendo', async () => {
    const { org, token } = await cenario();
    expect((await trocar(token, '0000', '5678')).status).toBe(403);
    expect((await login(org.slug, '1234')).status).toBe(200);
  });

  it('recusa PIN novo igual ao atual, com letras ou fora de 4 a 8 dígitos', async () => {
    const { token } = await cenario();
    expect((await trocar(token, '1234', '1234')).status).toBe(422);
    expect((await trocar(token, '1234', '12ab')).status).toBe(422);
    expect((await trocar(token, '1234', '123')).status).toBe(422);
    expect((await trocar(token, '1234', '123456789')).status).toBe(422);
  });

  it('gerente que entra por PIN precisa de PIN de 6+ dígitos', async () => {
    const { token } = await cenario(PerfilUsuario.GERENTE);
    expect((await trocar(token, '1234', '5678')).status).toBe(422);
    expect((await trocar(token, '1234', '567890')).status).toBe(204);
  });

  it('sem login, 401', async () => {
    expect((await request(app).put('/api/perfil/pin').send({ pinAtual: '1234', novoPin: '5678' })).status).toBe(401);
  });
});
