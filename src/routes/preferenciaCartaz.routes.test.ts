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

  it('dicionário de descrições de produto aceita mais que o teto das outras preferências', async () => {
    const org = await criarOrganizacao();
    const token = gerarToken(await criarAdmin(org.id));
    // ~1.000 produtos editados (> 32 KB) — o teto das cores/tamanhos barraria isto.
    const valor = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`ean:789${String(i).padStart(10, '0')}`, `Creme Dental Exemplo ${i} 70g`]));

    const salvo = await request(app).put('/api/cartazes/preferencias/descricoes_produto').set('Authorization', `Bearer ${token}`).send({ valor });
    expect(salvo.status).toBe(200);

    const grandeDemaisPraStory = await request(app).put('/api/cartazes/preferencias/story').set('Authorization', `Bearer ${token}`).send({ valor });
    expect(grandeDemaisPraStory.status).toBe(422);
  });

  it('biblioteca de recortes de produto aceita catálogo grande e vale pra qualquer login da organização', async () => {
    const org = await criarOrganizacao();
    const tokenAdmin = gerarToken(await criarAdmin(org.id));
    const tokenFuncionario = gerarToken(await criarFuncionario(org.id));
    // ~1.000 produtos recortados (> 32 KB).
    const valor = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`ean:789${String(i).padStart(10, '0')}`, { arquivoId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, em: '2026-10-29T12:00:00.000Z' }]));

    const salvo = await request(app).put('/api/cartazes/preferencias/recortes_produto').set('Authorization', `Bearer ${tokenFuncionario}`).send({ valor });
    expect(salvo.status).toBe(200);

    const lista = await request(app).get('/api/cartazes/preferencias').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(Object.keys(lista.body.recortes_produto)).toHaveLength(1000);
  });

  it('folha A4 do Cartaz de oferta fica no servidor e vale pra qualquer login da organização', async () => {
    const org = await criarOrganizacao();
    const tokenAdmin = gerarToken(await criarAdmin(org.id));
    const tokenFuncionario = gerarToken(await criarFuncionario(org.id));
    const lote = Array.from({ length: 600 }, (_, i) => ({ produto: `FRALDA HUGGIES ${i}`, produtoOriginal: `FR HUGGIES ${i}`, preco: 41.99, precoAntigo: 54.99 }));
    const valor = { modo: 'lote', lote, porFolhaLote: 8, pagina: 2, fundo: { nome: 'fundo.png', arquivoId: 'abc' } };

    const salvo = await request(app).put('/api/cartazes/preferencias/cartaz_oferta').set('Authorization', `Bearer ${tokenFuncionario}`).send({ valor });
    expect(salvo.status).toBe(200);

    const lista = await request(app).get('/api/cartazes/preferencias').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(lista.body.cartaz_oferta.lote).toHaveLength(600);
    expect(lista.body.cartaz_oferta.pagina).toBe(2);
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
