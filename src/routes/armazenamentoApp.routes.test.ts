import request from 'supertest';
import { createApp } from '../app';
import { resetDb } from '../tests/helpers/db';
import { criarFuncionario, criarOrganizacao, gerarToken } from '../tests/helpers/factory';

describe('/api/armazenamento/:chave — concorrência otimista', () => {
  const app = createApp();
  beforeEach(resetDb);

  it('primeira gravação (versaoEsperada 0) cria o registro com versão 1', async () => {
    const org = await criarOrganizacao();
    const funcionario = await criarFuncionario(org.id);
    const token = gerarToken(funcionario);

    const res = await request(app)
      .put('/api/armazenamento/chave-teste')
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: JSON.stringify({ ok: true }), versaoEsperada: 0 });

    expect(res.status).toBe(200);
    expect(res.body.versao).toBe(1);
  });

  it('grava normalmente quando a versão esperada bate com a atual', async () => {
    const org = await criarOrganizacao();
    const funcionario = await criarFuncionario(org.id);
    const token = gerarToken(funcionario);

    await request(app)
      .put('/api/armazenamento/chave-teste')
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: JSON.stringify({ passo: 1 }), versaoEsperada: 0 });

    const res = await request(app)
      .put('/api/armazenamento/chave-teste')
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: JSON.stringify({ passo: 2 }), versaoEsperada: 1 });

    expect(res.status).toBe(200);
    expect(res.body.versao).toBe(2);
  });

  it('recusa com 409 quando outra gravação já aconteceu nesse meio-tempo', async () => {
    const org = await criarOrganizacao();
    const funcionario = await criarFuncionario(org.id);
    const token = gerarToken(funcionario);

    // "Aba A" carrega a versão 0 (nunca salvo) e grava primeiro.
    await request(app)
      .put('/api/armazenamento/chave-concorrente')
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: JSON.stringify({ quem: 'aba-a' }), versaoEsperada: 0 });

    // "Aba B" também carregou a versão 0 (antes de A salvar) e tenta gravar agora — deve ser recusada.
    const res = await request(app)
      .put('/api/armazenamento/chave-concorrente')
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: JSON.stringify({ quem: 'aba-b' }), versaoEsperada: 0 });

    expect(res.status).toBe(409);

    const atual = await request(app).get('/api/armazenamento/chave-concorrente').set('Authorization', `Bearer ${token}`);
    // A gravação recusada de B nunca deve ter sido aplicada.
    expect(JSON.parse(atual.body.valor)).toEqual({ quem: 'aba-a' });
  });

  it('devolve valor null e versão 0 pra uma chave que nunca foi salva', async () => {
    const org = await criarOrganizacao();
    const funcionario = await criarFuncionario(org.id);
    const token = gerarToken(funcionario);

    const res = await request(app).get('/api/armazenamento/chave-inexistente').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valor: null, versao: 0 });
  });
});
