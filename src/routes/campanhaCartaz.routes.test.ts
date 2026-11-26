import request from 'supertest';
import { createApp } from '../app';
import { resetDb } from '../tests/helpers/db';
import { criarAdmin, criarFuncionario, criarOrganizacao, gerarToken } from '../tests/helpers/factory';

jest.mock('../config/r2Client', () => ({
  chaveObjeto: jest.fn((organizacaoId: string, arquivoId: string) => `org/${organizacaoId}/${arquivoId}`),
  gerarUrlUpload: jest.fn(async () => ({ url: 'https://fake-r2.example.com/upload', expiraEm: new Date() })),
  gerarUrlDownload: jest.fn(async (key: string) => `https://fake-r2.example.com/${key}?download=1`),
  verificarObjetoEnviado: jest.fn(async () => ({ tamanhoBytes: 1000 })),
  apagarObjetos: jest.fn(async () => undefined),
  copiarObjeto: jest.fn(async () => undefined),
}));

describe('/api/cartazes/campanhas', () => {
  const app = createApp();
  beforeEach(resetDb);

  async function autenticar() {
    const org = await criarOrganizacao();
    return { org, token: gerarToken(await criarAdmin(org.id)) };
  }

  it('várias campanhas ao mesmo tempo, cada uma com os seus projetos', async () => {
    const { token } = await autenticar();
    const auth = { Authorization: `Bearer ${token}` };

    const black = await request(app).post('/api/cartazes/campanhas').set(auth).send({ nome: 'Black Friday — semana 1' });
    const natal = await request(app).post('/api/cartazes/campanhas').set(auth).send({ nome: 'Natal' });
    expect(black.status).toBe(201);

    await request(app).post('/api/cartazes/projetos').set(auth).send({ tipo: 'planilha', nome: 'Black Friday', campanhaId: black.body.id });
    await request(app).post('/api/cartazes/projetos').set(auth).send({ tipo: 'panfleto', nome: 'Black Friday', campanhaId: black.body.id });
    await request(app).post('/api/cartazes/projetos').set(auth).send({ tipo: 'panfleto', nome: 'Natal', campanhaId: natal.body.id });

    const doBlack = await request(app).get('/api/cartazes/projetos').query({ tipo: 'panfleto', campanhaId: black.body.id }).set(auth);
    expect(doBlack.body.map((p: { nome: string }) => p.nome)).toEqual(['Black Friday']);

    const lista = await request(app).get('/api/cartazes/campanhas').set(auth);
    const resumoBlack = lista.body.find((c: { id: string }) => c.id === black.body.id);
    expect(resumoBlack.projetos).toEqual({ story: 0, panfleto: 1, planilha: 1 });
    expect(resumoBlack.folhaOferta).toBeUndefined();
  });

  it('guarda a folha do Cartaz de oferta por campanha e vale pra qualquer login da organização', async () => {
    const { org, token } = await autenticar();
    const tokenFuncionario = gerarToken(await criarFuncionario(org.id));
    const campanha = await request(app).post('/api/cartazes/campanhas').set('Authorization', `Bearer ${token}`).send({ nome: 'Black' });

    const folhaOferta = { modo: 'lote', lote: [{ produto: 'FRALDA X', preco: 41.99 }], pagina: 1 };
    const salvo = await request(app).patch(`/api/cartazes/campanhas/${campanha.body.id}`).set('Authorization', `Bearer ${tokenFuncionario}`).send({ folhaOferta });
    expect(salvo.status).toBe(200);

    const aberta = await request(app).get(`/api/cartazes/campanhas/${campanha.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(aberta.body.folhaOferta).toEqual(folhaOferta);
  });

  it('cada campanha tem a sua aparência (fundos, cores, logo) — mexer numa não muda a outra', async () => {
    const { token } = await autenticar();
    const auth = { Authorization: `Bearer ${token}` };
    const a = await request(app)
      .post('/api/cartazes/campanhas')
      .set(auth)
      .send({ nome: 'A', aparencia: { panfleto: { panfletoFundo: { nome: 'fundo-a.png', arquivoId: 'a' }, itensPorPagina: 9 } } });
    const b = await request(app).post('/api/cartazes/campanhas').set(auth).send({ nome: 'B', aparencia: { panfleto: { itensPorPagina: 9 } } });

    // Salva só uma chave por vez: as outras continuam como estavam.
    await request(app).patch(`/api/cartazes/campanhas/${b.body.id}`).set(auth).send({ aparencia: { story: { corLogo: '#000000' } } });
    await request(app).patch(`/api/cartazes/campanhas/${b.body.id}`).set(auth).send({ aparencia: { panfleto: { panfletoFundo: { nome: 'fundo-b.png', arquivoId: 'b' } } } });

    const lidaA = await request(app).get(`/api/cartazes/campanhas/${a.body.id}`).set(auth);
    const lidaB = await request(app).get(`/api/cartazes/campanhas/${b.body.id}`).set(auth);
    expect(lidaA.body.aparencia.panfleto.panfletoFundo.nome).toBe('fundo-a.png');
    expect(lidaB.body.aparencia.panfleto.panfletoFundo.nome).toBe('fundo-b.png');
    expect(lidaB.body.aparencia.story).toEqual({ corLogo: '#000000' });
    expect(lidaA.body.aparencia.story).toBeUndefined();

    const chaveDesconhecida = await request(app).patch(`/api/cartazes/campanhas/${a.body.id}`).set(auth).send({ aparencia: { outra: {} } });
    expect(chaveDesconhecida.status).toBe(422);
  });

  it('não deixa usar campanha de outra organização', async () => {
    const { token } = await autenticar();
    const outra = await autenticar();
    const campanhaAlheia = await request(app).post('/api/cartazes/campanhas').set('Authorization', `Bearer ${outra.token}`).send({ nome: 'Alheia' });

    const projeto = await request(app).post('/api/cartazes/projetos').set('Authorization', `Bearer ${token}`).send({ tipo: 'story', nome: 'X', campanhaId: campanhaAlheia.body.id });
    expect(projeto.status).toBe(404);
    const leitura = await request(app).get(`/api/cartazes/campanhas/${campanhaAlheia.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(leitura.status).toBe(404);
  });

  it('apagar a campanha apaga os projetos dela e mais nenhum', async () => {
    const { token } = await autenticar();
    const auth = { Authorization: `Bearer ${token}` };
    const fica = await request(app).post('/api/cartazes/campanhas').set(auth).send({ nome: 'Fica' });
    const sai = await request(app).post('/api/cartazes/campanhas').set(auth).send({ nome: 'Sai' });
    await request(app).post('/api/cartazes/projetos').set(auth).send({ tipo: 'story', nome: 'Fica', campanhaId: fica.body.id });
    await request(app).post('/api/cartazes/projetos').set(auth).send({ tipo: 'story', nome: 'Sai', campanhaId: sai.body.id });

    expect((await request(app).delete(`/api/cartazes/campanhas/${sai.body.id}`).set(auth)).status).toBe(204);

    const projetos = await request(app).get('/api/cartazes/projetos').set(auth);
    expect(projetos.body.map((p: { nome: string }) => p.nome)).toEqual(['Fica']);
  });
});
