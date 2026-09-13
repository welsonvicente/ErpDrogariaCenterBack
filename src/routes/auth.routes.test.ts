import request from 'supertest';
import { createApp } from '../app';
import { resetDb } from '../tests/helpers/db';
import { criarFuncionario, criarOrganizacao } from '../tests/helpers/factory';

describe('POST /api/auth/funcionario-login', () => {
  beforeEach(resetDb);

  it('autentica com código+PIN corretos e devolve um token', async () => {
    const app = createApp();
    const org = await criarOrganizacao({ slug: 'farmacia-login-ok' });
    const funcionario = await criarFuncionario(org.id, { codigo: '1', nome: 'Welson' });
    // O PIN de teste do factory é sempre '1234' (ver tests/helpers/factory.ts).

    const res = await request(app)
      .post('/api/auth/funcionario-login')
      .send({ organizacaoSlug: 'farmacia-login-ok', codigo: '1', pin: '1234' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.usuario.nome).toBe('Welson');
  });

  it('rejeita PIN errado com 401', async () => {
    const app = createApp();
    const org = await criarOrganizacao({ slug: 'farmacia-login-pin-errado' });
    await criarFuncionario(org.id, { codigo: '1' });

    const res = await request(app)
      .post('/api/auth/funcionario-login')
      .send({ organizacaoSlug: 'farmacia-login-pin-errado', codigo: '1', pin: '0000' });

    expect(res.status).toBe(401);
  });
});
