import request from 'supertest';
import { createApp } from '../app';
import { resetDb } from '../tests/helpers/db';
import { criarAdmin, criarFuncionario, criarOrganizacao, gerarToken } from '../tests/helpers/factory';

describe('/api/cartazes/arquivos', () => {
  const app = createApp();
  beforeEach(resetDb);

  it('salva um arquivo enviado e devolve os metadados (sem o conteúdo)', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const token = gerarToken(admin);
    const conteudo = Buffer.from('linha1;linha2').toString('base64');

    const res = await request(app)
      .post('/api/cartazes/arquivos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nomeArquivo: 'ofertas.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', conteudoBase64: conteudo });

    expect(res.status).toBe(201);
    expect(res.body.nomeOriginal).toBe('ofertas.xlsx');
    expect(res.body.tamanhoBytes).toBe(Buffer.from('linha1;linha2').length);
    expect(res.body.conteudoBase64).toBeUndefined();
  });

  it('lista os arquivos da organização sem o conteúdo binário', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const token = gerarToken(admin);
    await request(app)
      .post('/api/cartazes/arquivos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nomeArquivo: 'a.xlsx', mimeType: 'application/xlsx', conteudoBase64: Buffer.from('a').toString('base64') });
    await request(app)
      .post('/api/cartazes/arquivos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nomeArquivo: 'b.xlsx', mimeType: 'application/xlsx', conteudoBase64: Buffer.from('bb').toString('base64') });

    const res = await request(app).get('/api/cartazes/arquivos').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // `select` no repositório exclui a coluna binária — a lista não deve trazer o conteúdo, só metadados.
    expect(res.body[0].conteudo).toBeUndefined();
    expect(res.body.map((a: { nomeOriginal: string }) => a.nomeOriginal).sort()).toEqual(['a.xlsx', 'b.xlsx']);
  });

  it('baixa um arquivo salvo com o conteúdo original intacto', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const token = gerarToken(admin);
    const textoOriginal = 'coluna1,coluna2\nproduto,9.99';
    const envio = await request(app)
      .post('/api/cartazes/arquivos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nomeArquivo: 'planilha.csv', mimeType: 'text/csv', conteudoBase64: Buffer.from(textoOriginal).toString('base64') });

    const res = await request(app).get(`/api/cartazes/arquivos/${envio.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.nomeOriginal).toBe('planilha.csv');
    expect(Buffer.from(res.body.conteudoBase64, 'base64').toString('utf-8')).toBe(textoOriginal);
  });

  it('remove um arquivo salvo', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const token = gerarToken(admin);
    const envio = await request(app)
      .post('/api/cartazes/arquivos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nomeArquivo: 'apagar.xlsx', mimeType: 'application/xlsx', conteudoBase64: Buffer.from('x').toString('base64') });

    const remocao = await request(app).delete(`/api/cartazes/arquivos/${envio.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(remocao.status).toBe(204);

    const listaDepois = await request(app).get('/api/cartazes/arquivos').set('Authorization', `Bearer ${token}`);
    expect(listaDepois.body).toHaveLength(0);
  });

  it('não deixa uma organização ver, baixar ou remover o arquivo de outra', async () => {
    const orgA = await criarOrganizacao();
    const orgB = await criarOrganizacao();
    const adminA = await criarAdmin(orgA.id);
    const adminB = await criarAdmin(orgB.id);
    const tokenA = gerarToken(adminA);
    const tokenB = gerarToken(adminB);

    const envio = await request(app)
      .post('/api/cartazes/arquivos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nomeArquivo: 'privado.xlsx', mimeType: 'application/xlsx', conteudoBase64: Buffer.from('segredo').toString('base64') });

    const listaB = await request(app).get('/api/cartazes/arquivos').set('Authorization', `Bearer ${tokenB}`);
    expect(listaB.body).toHaveLength(0);

    const baixarB = await request(app).get(`/api/cartazes/arquivos/${envio.body.id}`).set('Authorization', `Bearer ${tokenB}`);
    expect(baixarB.status).toBe(404);

    const removerB = await request(app).delete(`/api/cartazes/arquivos/${envio.body.id}`).set('Authorization', `Bearer ${tokenB}`);
    expect(removerB.status).toBe(404);
  });

  it('funcionário (não só gerente) também consegue enviar e listar — ferramenta é de uso do balcão', async () => {
    const org = await criarOrganizacao();
    const funcionario = await criarFuncionario(org.id);
    const token = gerarToken(funcionario);

    const envio = await request(app)
      .post('/api/cartazes/arquivos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nomeArquivo: 'do-balcao.xlsx', mimeType: 'application/xlsx', conteudoBase64: Buffer.from('y').toString('base64') });
    expect(envio.status).toBe(201);

    const lista = await request(app).get('/api/cartazes/arquivos').set('Authorization', `Bearer ${token}`);
    expect(lista.status).toBe(200);
    expect(lista.body).toHaveLength(1);
  });

  it('rejeita sem estar autenticado', async () => {
    const res = await request(app).get('/api/cartazes/arquivos');
    expect(res.status).toBe(401);
  });
});
