import request from 'supertest';
import { createApp } from '../app';
import { resetDb } from '../tests/helpers/db';
import { criarFuncionario, criarOrganizacao } from '../tests/helpers/factory';

/**
 * O login não tem limite de tentativas, por decisão do dono (17/10/2026): o
 * limite por IP travou a loja inteira, que sai toda pelo mesmo IP. Estes testes
 * garantem que nenhum bloqueio volte sem querer.
 */
describe('POST /api/auth/funcionario-login — sem bloqueio por tentativas', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('muitos erros seguidos nunca viram 429, e o PIN certo entra em seguida', async () => {
    const app = createApp();
    const org = await criarOrganizacao({ slug: 'farmacia-sem-limite' });
    await criarFuncionario(org.id, { codigo: '7' });

    for (let i = 0; i < 30; i++) {
      const res = await request(app)
        .post('/api/auth/funcionario-login')
        .send({ organizacaoSlug: 'farmacia-sem-limite', codigo: '7', pin: '0000' });
      expect(res.status).toBe(401);
    }

    const comPinCerto = await request(app)
      .post('/api/auth/funcionario-login')
      .send({ organizacaoSlug: 'farmacia-sem-limite', codigo: '7', pin: '1234' });
    expect(comPinCerto.status).toBe(200);
  });
});
