import request from 'supertest';
import { createApp } from '../app';
import { _resetLoginRateLimit } from '../middlewares/rateLimitMiddleware';
import { resetDb } from '../tests/helpers/db';
import { criarFuncionario, criarOrganizacao } from '../tests/helpers/factory';

/**
 * Isolado no próprio arquivo de propósito: `loginRateLimiter` (ver
 * rateLimitMiddleware.ts) é criado uma única vez no carregamento do módulo de
 * rotas, então qualquer outro teste que bata em /auth/* no MESMO arquivo
 * compartilharia o mesmo contador — o Jest só reseta o registro de módulos entre
 * arquivos, não entre testes de um mesmo arquivo. Por isso o reset no beforeEach.
 *
 * Hoje a única proteção é o limite por IP: 10 chamadas por janela. Houve também
 * um bloqueio por conta (5 erros na mesma conta), removido a pedido — sem ele,
 * quem troca de IP não é contido, e o balcão inteiro atrás de um NAT divide a
 * mesma cota.
 */
describe('Rate limit em POST /api/auth/funcionario-login', () => {
  beforeEach(async () => {
    await resetDb();
    await _resetLoginRateLimit();
  });

  it('permite 10 tentativas por IP e bloqueia a 11ª com 429', async () => {
    const app = createApp();
    const org = await criarOrganizacao({ slug: 'farmacia-rate-limit' });
    await criarFuncionario(org.id, { codigo: '1' });

    const tentar = () =>
      request(app)
        .post('/api/auth/funcionario-login')
        .send({ organizacaoSlug: 'farmacia-rate-limit', codigo: '1', pin: '0000' });

    for (let i = 0; i < 10; i++) {
      expect((await tentar()).status).toBe(401); // PIN errado, mas dentro do limite
    }

    expect((await tentar()).status).toBe(429);
  });

  it('errar o PIN não tranca a conta — o PIN certo entra em seguida', async () => {
    const app = createApp();
    const org = await criarOrganizacao({ slug: 'farmacia-sem-bloqueio' });
    await criarFuncionario(org.id, { codigo: '7' });

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/funcionario-login')
        .send({ organizacaoSlug: 'farmacia-sem-bloqueio', codigo: '7', pin: '0000' });
    }

    const comPinCerto = await request(app)
      .post('/api/auth/funcionario-login')
      .send({ organizacaoSlug: 'farmacia-sem-bloqueio', codigo: '7', pin: '1234' });
    expect(comPinCerto.status).toBe(200);
  });
});
