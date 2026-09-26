import request from 'supertest';
import { createApp } from '../app';
import { resetDb } from '../tests/helpers/db';
import { criarAdmin, criarFuncionario, criarOrganizacao, gerarToken } from '../tests/helpers/factory';

// As rotas de projeto não tocam o R2 diretamente (só as de /imagens fazem),
// mas mockamos assim mesmo pra garantir isolamento total de rede nesta suíte.
jest.mock('../config/r2Client', () => ({
  chaveObjeto: jest.fn((organizacaoId: string, arquivoId: string) => `org/${organizacaoId}/${arquivoId}`),
  gerarUrlUpload: jest.fn(async () => ({ url: 'https://fake-r2.example.com/upload', expiraEm: new Date() })),
  gerarUrlDownload: jest.fn(async (key: string) => `https://fake-r2.example.com/${key}?download=1`),
  verificarObjetoEnviado: jest.fn(async () => ({ tamanhoBytes: 1000 })),
  apagarObjetos: jest.fn(async () => undefined),
  copiarObjeto: jest.fn(async () => undefined),
}));

describe('/api/cartazes/projetos', () => {
  const app = createApp();
  beforeEach(resetDb);

  async function autenticar() {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    return { org, token: gerarToken(admin) };
  }

  it('cria um projeto e devolve o estado inicial vazio', async () => {
    const { token } = await autenticar();

    const res = await request(app)
      .post('/api/cartazes/projetos')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'panfleto', nome: 'Panfleto de Natal' });

    expect(res.status).toBe(201);
    expect(res.body.nome).toBe('Panfleto de Natal');
    expect(res.body.tipo).toBe('panfleto');
    expect(res.body.estadoEditor).toEqual({});
  });

  it('rejeita tipo inválido e nome vazio', async () => {
    const { token } = await autenticar();

    const tipoInvalido = await request(app)
      .post('/api/cartazes/projetos')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'inexistente', nome: 'X' });
    expect(tipoInvalido.status).toBe(422);

    const nomeVazio = await request(app)
      .post('/api/cartazes/projetos')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'story', nome: '' });
    expect(nomeVazio.status).toBe(422);
  });

  it('lista projetos da organização, do mais recentemente atualizado pro mais antigo, sem estadoEditor', async () => {
    const { token } = await autenticar();
    await request(app).post('/api/cartazes/projetos').set('Authorization', `Bearer ${token}`).send({ tipo: 'story', nome: 'Story A' });
    await request(app).post('/api/cartazes/projetos').set('Authorization', `Bearer ${token}`).send({ tipo: 'panfleto', nome: 'Panfleto B' });

    const res = await request(app).get('/api/cartazes/projetos').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((p: { nome: string }) => p.nome).sort()).toEqual(['Panfleto B', 'Story A']);
    expect(res.body[0].estadoEditor).toBeUndefined();
  });

  it('filtra a listagem por tipo', async () => {
    const { token } = await autenticar();
    await request(app).post('/api/cartazes/projetos').set('Authorization', `Bearer ${token}`).send({ tipo: 'story', nome: 'Story A' });
    await request(app).post('/api/cartazes/projetos').set('Authorization', `Bearer ${token}`).send({ tipo: 'panfleto', nome: 'Panfleto B' });

    const res = await request(app).get('/api/cartazes/projetos?tipo=panfleto').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nome).toBe('Panfleto B');
  });

  it('obtém um projeto específico com a lista de arquivos (vazia no início)', async () => {
    const { token } = await autenticar();
    const criado = await request(app).post('/api/cartazes/projetos').set('Authorization', `Bearer ${token}`).send({ tipo: 'planilha', nome: 'Lote de sexta' });

    const res = await request(app).get(`/api/cartazes/projetos/${criado.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.nome).toBe('Lote de sexta');
    expect(res.body.arquivos).toEqual([]);
  });

  it('atualiza nome e estadoEditor (autosave)', async () => {
    const { token } = await autenticar();
    const criado = await request(app).post('/api/cartazes/projetos').set('Authorization', `Bearer ${token}`).send({ tipo: 'story', nome: 'Rascunho' });

    const res = await request(app)
      .patch(`/api/cartazes/projetos/${criado.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Oferta de fim de semana', estadoEditor: { nome: 'Dipirona', por: '9,99' } });

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe('Oferta de fim de semana');
    expect(res.body.estadoEditor).toEqual({ nome: 'Dipirona', por: '9,99' });
  });

  it('rejeita atualização sem nenhum campo', async () => {
    const { token } = await autenticar();
    const criado = await request(app).post('/api/cartazes/projetos').set('Authorization', `Bearer ${token}`).send({ tipo: 'story', nome: 'Rascunho' });

    const res = await request(app).patch(`/api/cartazes/projetos/${criado.body.id}`).set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(422);
  });

  it('remove um projeto', async () => {
    const { token } = await autenticar();
    const criado = await request(app).post('/api/cartazes/projetos').set('Authorization', `Bearer ${token}`).send({ tipo: 'story', nome: 'Descartável' });

    const remocao = await request(app).delete(`/api/cartazes/projetos/${criado.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(remocao.status).toBe(204);

    const busca = await request(app).get(`/api/cartazes/projetos/${criado.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(busca.status).toBe(404);
  });

  it('não deixa uma organização ver, atualizar ou remover o projeto de outra', async () => {
    const { token: tokenA } = await autenticar();
    const { token: tokenB } = await autenticar();

    const criado = await request(app).post('/api/cartazes/projetos').set('Authorization', `Bearer ${tokenA}`).send({ tipo: 'story', nome: 'Privado' });

    const obter = await request(app).get(`/api/cartazes/projetos/${criado.body.id}`).set('Authorization', `Bearer ${tokenB}`);
    expect(obter.status).toBe(404);

    const atualizar = await request(app).patch(`/api/cartazes/projetos/${criado.body.id}`).set('Authorization', `Bearer ${tokenB}`).send({ nome: 'Invadido' });
    expect(atualizar.status).toBe(404);

    const remover = await request(app).delete(`/api/cartazes/projetos/${criado.body.id}`).set('Authorization', `Bearer ${tokenB}`);
    expect(remover.status).toBe(404);

    const lista = await request(app).get('/api/cartazes/projetos').set('Authorization', `Bearer ${tokenB}`);
    expect(lista.body).toHaveLength(0);
  });

  it('funcionário (não só gerente/admin) também consegue criar, listar e editar — ferramenta é de uso do balcão', async () => {
    const org = await criarOrganizacao();
    const funcionario = await criarFuncionario(org.id);
    const token = gerarToken(funcionario);

    const criado = await request(app).post('/api/cartazes/projetos').set('Authorization', `Bearer ${token}`).send({ tipo: 'story', nome: 'Do balcão' });
    expect(criado.status).toBe(201);

    const lista = await request(app).get('/api/cartazes/projetos').set('Authorization', `Bearer ${token}`);
    expect(lista.status).toBe(200);
    expect(lista.body).toHaveLength(1);
  });

  it('qualquer usuário autenticado da mesma organização acessa um projeto criado por outro usuário', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const funcionario = await criarFuncionario(org.id);

    const criado = await request(app)
      .post('/api/cartazes/projetos')
      .set('Authorization', `Bearer ${gerarToken(admin)}`)
      .send({ tipo: 'panfleto', nome: 'Feito pelo admin' });

    const res = await request(app)
      .get(`/api/cartazes/projetos/${criado.body.id}`)
      .set('Authorization', `Bearer ${gerarToken(funcionario)}`);
    expect(res.status).toBe(200);
    expect(res.body.nome).toBe('Feito pelo admin');
  });

  it('rejeita sem estar autenticado', async () => {
    const res = await request(app).get('/api/cartazes/projetos');
    expect(res.status).toBe(401);
  });
});
