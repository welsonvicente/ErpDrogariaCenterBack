import request from 'supertest';
import { createApp } from '../app';
import { resetDb } from '../tests/helpers/db';
import { criarCategoria, criarFuncionario, criarOrganizacao, gerarToken } from '../tests/helpers/factory';

describe('/api/despesas', () => {
  const app = createApp();
  beforeEach(resetDb);

  it('rejeita sem token de autenticação (401)', async () => {
    const res = await request(app).get('/api/despesas');
    expect(res.status).toBe(401);
  });

  it('funcionário consegue lançar uma despesa própria', async () => {
    const org = await criarOrganizacao();
    const funcionario = await criarFuncionario(org.id);
    const categoria = await criarCategoria(org.id);
    const token = gerarToken(funcionario);

    const res = await request(app)
      .post('/api/despesas')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: '2026-09-13', valor: 25, formaPagamento: 'DINHEIRO', categoriaId: categoria.id });

    expect(res.status).toBe(201);
    expect(res.body.usuarioId).toBe(funcionario.id);
  });

  it('funcionário (não-gestor) não pode listar todas as despesas da organização (403)', async () => {
    const org = await criarOrganizacao();
    const funcionario = await criarFuncionario(org.id);
    const token = gerarToken(funcionario);

    const res = await request(app).get('/api/despesas').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('funcionário só vê os próprios lançamentos em /minhas, mesmo existindo despesas de outro colega', async () => {
    const org = await criarOrganizacao();
    const funcionarioA = await criarFuncionario(org.id, { nome: 'Funcionário A' });
    const funcionarioB = await criarFuncionario(org.id, { nome: 'Funcionário B' });
    const categoria = await criarCategoria(org.id);
    const tokenA = gerarToken(funcionarioA);

    await request(app)
      .post('/api/despesas')
      .set('Authorization', `Bearer ${gerarToken(funcionarioB)}`)
      .send({ data: '2026-09-13', valor: 10, formaPagamento: 'DINHEIRO', categoriaId: categoria.id });
    await request(app)
      .post('/api/despesas')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ data: '2026-09-13', valor: 20, formaPagamento: 'DINHEIRO', categoriaId: categoria.id });

    const res = await request(app).get('/api/despesas/minhas').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].usuarioId).toBe(funcionarioA.id);
  });
});
