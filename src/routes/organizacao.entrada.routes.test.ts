import request from 'supertest';
import { createApp } from '../app';
import { resetDb } from '../tests/helpers/db';
import { criarOrganizacao } from '../tests/helpers/factory';

describe('GET /api/organizacao/:slug/entrada', () => {
  beforeEach(resetDb);

  it('confirma uma organização ativa sem expor dados dela', async () => {
    await criarOrganizacao({ slug: 'drogaria-ativa' });

    const resposta = await request(createApp()).get('/api/organizacao/drogaria-ativa/entrada');

    expect(resposta.status).toBe(204);
    expect(resposta.text).toBe('');
  });

  it('não confirma um slug inexistente', async () => {
    const resposta = await request(createApp()).get('/api/organizacao/inexistente/entrada');

    expect(resposta.status).toBe(404);
  });
});
