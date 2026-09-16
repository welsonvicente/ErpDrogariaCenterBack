import request from 'supertest';
import { createApp } from '../app';
import { resetDb } from '../tests/helpers/db';
import { _resetLoginRateLimit } from '../middlewares/rateLimitMiddleware';
import { criarFuncionario, criarOrganizacao } from '../tests/helpers/factory';
import { _limparTudo } from '../utils/tentativasLogin';

/**
 * Isolado no próprio arquivo de propósito: `loginRateLimiter` (ver
 * rateLimitMiddleware.ts) é criado uma única vez no carregamento do módulo
 * de rotas, então qualquer outro teste que bata em /auth/* no MESMO arquivo
 * compartilharia o mesmo contador — o Jest só reseta o registro de módulos
 * entre arquivos, não entre testes de um mesmo arquivo. Por isso os dois
 * contadores (por IP e por conta) são zerados no `beforeEach`.
 *
 * São DUAS proteções em camadas, com propósitos diferentes:
 *  - por CONTA (utils/tentativasLogin.ts): 5 erros na mesma conta a bloqueiam.
 *    É o que contém força bruta de verdade, inclusive de quem troca de IP.
 *  - por IP (rateLimitMiddleware.ts): 10 chamadas por IP na janela. É o teto
 *    geral, que também cobre quem varre VÁRIAS contas diferentes.
 */
describe('Proteção de força bruta em POST /api/auth/funcionario-login', () => {
  beforeEach(async () => {
    await resetDb();
    _limparTudo();
    await _resetLoginRateLimit();
  });

  it('bloqueia a conta depois de 5 tentativas erradas, antes mesmo do limite por IP', async () => {
    const app = createApp();
    const org = await criarOrganizacao({ slug: 'farmacia-rate-limit' });
    await criarFuncionario(org.id, { codigo: '1' });

    const tentar = () =>
      request(app)
        .post('/api/auth/funcionario-login')
        .send({ organizacaoSlug: 'farmacia-rate-limit', codigo: '1', pin: '0000' });

    for (let i = 0; i < 5; i++) {
      expect((await tentar()).status).toBe(401); // PIN errado, conta ainda liberada
    }

    const bloqueada = await tentar();
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body.message).toMatch(/tentativas erradas/i);
  });

  it('o PIN certo não passa enquanto a conta está bloqueada', async () => {
    const app = createApp();
    const org = await criarOrganizacao({ slug: 'farmacia-bloqueio' });
    await criarFuncionario(org.id, { codigo: '7' });

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/funcionario-login')
        .send({ organizacaoSlug: 'farmacia-bloqueio', codigo: '7', pin: '0000' });
    }

    const comPinCerto = await request(app)
      .post('/api/auth/funcionario-login')
      .send({ organizacaoSlug: 'farmacia-bloqueio', codigo: '7', pin: '1234' });
    expect(comPinCerto.status).toBe(429);
  });

  it('bloquear uma conta não trava as outras — o balcão inteiro sai pelo mesmo IP', async () => {
    const app = createApp();
    const org = await criarOrganizacao({ slug: 'farmacia-isolada' });
    await criarFuncionario(org.id, { codigo: '7' });
    await criarFuncionario(org.id, { codigo: '8' });

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/funcionario-login')
        .send({ organizacaoSlug: 'farmacia-isolada', codigo: '7', pin: '0000' });
    }

    const colega = await request(app)
      .post('/api/auth/funcionario-login')
      .send({ organizacaoSlug: 'farmacia-isolada', codigo: '8', pin: '1234' });
    expect(colega.status).toBe(200);
  });

  it('o limite por IP ainda existe, pra quem varre várias contas diferentes', async () => {
    const app = createApp();
    const org = await criarOrganizacao({ slug: 'farmacia-por-ip' });
    await criarFuncionario(org.id, { codigo: '1' });

    // Código diferente a cada tentativa: nunca acumula 5 falhas na MESMA conta,
    // então quem barra aqui é o limite por IP, na 11ª chamada.
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/auth/funcionario-login')
        .send({ organizacaoSlug: 'farmacia-por-ip', codigo: `cod-${i}`, pin: '0000' });
      expect(res.status).toBe(401);
    }

    const decimaPrimeira = await request(app)
      .post('/api/auth/funcionario-login')
      .send({ organizacaoSlug: 'farmacia-por-ip', codigo: 'cod-x', pin: '0000' });
    expect(decimaPrimeira.status).toBe(429);
  });
});
