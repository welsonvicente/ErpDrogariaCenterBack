import request from 'supertest';
import { createApp } from '../app';
import { resetDb } from '../tests/helpers/db';
import { criarAdmin, criarFuncionario, criarOrganizacao, gerarToken } from '../tests/helpers/factory';

describe('/api/cartazes/preferencias', () => {
  const app = createApp();
  beforeEach(resetDb);

  it('começa vazio e devolve o que foi salvo, por chave', async () => {
    const org = await criarOrganizacao();
    const token = gerarToken(await criarAdmin(org.id));

    const vazio = await request(app).get('/api/cartazes/preferencias').set('Authorization', `Bearer ${token}`);
    expect(vazio.status).toBe(200);
    expect(vazio.body).toEqual({});

    const salvo = await request(app)
      .put('/api/cartazes/preferencias/story')
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: { corPreco: '#E30613', corFundoPreco: 'transparent' } });
    expect(salvo.status).toBe(200);

    const lista = await request(app).get('/api/cartazes/preferencias').set('Authorization', `Bearer ${token}`);
    expect(lista.body).toEqual({ story: { corPreco: '#E30613', corFundoPreco: 'transparent' } });
  });

  it('salvar de novo substitui (não duplica) e vale pra qualquer login da mesma organização', async () => {
    const org = await criarOrganizacao();
    const tokenAdmin = gerarToken(await criarAdmin(org.id));
    const tokenFuncionario = gerarToken(await criarFuncionario(org.id));

    await request(app).put('/api/cartazes/preferencias/panfleto').set('Authorization', `Bearer ${tokenAdmin}`).send({ valor: { itensPorPagina: 6 } });
    await request(app).put('/api/cartazes/preferencias/panfleto').set('Authorization', `Bearer ${tokenFuncionario}`).send({ valor: { itensPorPagina: 9 } });

    const lista = await request(app).get('/api/cartazes/preferencias').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(lista.body).toEqual({ panfleto: { itensPorPagina: 9 } });
  });

  it('isola por organização', async () => {
    const orgA = await criarOrganizacao();
    const orgB = await criarOrganizacao();
    const tokenA = gerarToken(await criarAdmin(orgA.id));
    const tokenB = gerarToken(await criarAdmin(orgB.id));

    await request(app).put('/api/cartazes/preferencias/story').set('Authorization', `Bearer ${tokenA}`).send({ valor: { corLogo: '#000000' } });

    const listaB = await request(app).get('/api/cartazes/preferencias').set('Authorization', `Bearer ${tokenB}`);
    expect(listaB.body).toEqual({});
  });

  it('rejeita chave desconhecida, valor que não é objeto e falta de login', async () => {
    const org = await criarOrganizacao();
    const token = gerarToken(await criarAdmin(org.id));

    const chaveInvalida = await request(app).put('/api/cartazes/preferencias/qualquer').set('Authorization', `Bearer ${token}`).send({ valor: {} });
    expect(chaveInvalida.status).toBe(422);

    const valorInvalido = await request(app).put('/api/cartazes/preferencias/story').set('Authorization', `Bearer ${token}`).send({ valor: 'azul' });
    expect(valorInvalido.status).toBe(422);

    const semLogin = await request(app).get('/api/cartazes/preferencias');
    expect(semLogin.status).toBe(401);
  });
});
