import request from 'supertest';
import { createApp } from '../app';
import { resetDb } from '../tests/helpers/db';
import { criarFuncionario, criarOrganizacao } from '../tests/helpers/factory';

/**
 * Isolado no próprio arquivo de propósito: `loginRateLimiter` (ver
 * rateLimitMiddleware.ts) é criado uma única vez no carregamento do módulo
 * de rotas, então qualquer outro teste que bata em /auth/* no MESMO arquivo
 * compartilharia o mesmo contador — o Jest só reseta o registro de módulos
 * entre arquivos, não entre testes de um mesmo arquivo.
 */
describe('Rate limit em POST /api/auth/funcionario-login', () => {
  beforeEach(resetDb);

  it('permite 10 tentativas e bloqueia a 11ª com 429', async () => {
    const app = createApp();
    const org = await criarOrganizacao({ slug: 'farmacia-rate-limit' });
    await criarFuncionario(org.id, { codigo: '1' });

    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/auth/funcionario-login')
        .send({ organizacaoSlug: 'farmacia-rate-limit', codigo: '1', pin: '0000' });
      expect(res.status).toBe(401); // senha errada, mas ainda dentro do limite
    }

    const decimaPrimeira = await request(app)
      .post('/api/auth/funcionario-login')
      .send({ organizacaoSlug: 'farmacia-rate-limit', codigo: '1', pin: '0000' });
    expect(decimaPrimeira.status).toBe(429);
  });
});
