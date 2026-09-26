import request from 'supertest';
import { createApp } from '../app';
import { resetDb } from '../tests/helpers/db';
import { criarAdmin, criarOrganizacao, gerarToken } from '../tests/helpers/factory';
import { verificarObjetoEnviado } from '../config/r2Client';

jest.mock('../config/r2Client', () => ({
  chaveObjeto: jest.fn((organizacaoId: string, arquivoId: string) => `org/${organizacaoId}/${arquivoId}`),
  gerarUrlUpload: jest.fn(async (key: string) => ({ url: `https://fake-r2.example.com/${key}`, expiraEm: new Date(Date.now() + 300_000) })),
  gerarUrlDownload: jest.fn(async (key: string) => `https://fake-r2.example.com/${key}?download=1`),
  verificarObjetoEnviado: jest.fn(async () => ({ tamanhoBytes: 245678 })),
  apagarObjetos: jest.fn(async () => undefined),
  copiarObjeto: jest.fn(async () => undefined),
}));

const verificarObjetoEnviadoMock = verificarObjetoEnviado as jest.Mock;

describe('/api/cartazes/imagens', () => {
  const app = createApp();
  beforeEach(async () => {
    await resetDb();
    verificarObjetoEnviadoMock.mockClear();
    verificarObjetoEnviadoMock.mockResolvedValue({ tamanhoBytes: 245678 });
  });

  async function autenticar() {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    return { org, token: gerarToken(admin) };
  }

  async function criarProjeto(token: string, tipo = 'story', nome = 'Projeto de teste') {
    const res = await request(app).post('/api/cartazes/projetos').set('Authorization', `Bearer ${token}`).send({ tipo, nome });
    return res.body.id as string;
  }

  it('presigna um upload sem projeto ainda e devolve a URL + headers do PUT', async () => {
    const { token } = await autenticar();

    const res = await request(app)
      .post('/api/cartazes/imagens/presign')
      .set('Authorization', `Bearer ${token}`)
      .send({ mimeType: 'image/jpeg', tamanhoBytes: 300_000 });

    expect(res.status).toBe(201);
    expect(res.body.arquivoId).toBeDefined();
    expect(res.body.uploadUrl).toContain(res.body.arquivoId);
    expect(res.body.headers).toEqual({ 'Content-Type': 'image/jpeg' });
  });

  it('rejeita mimetype não suportado e tamanho acima do limite', async () => {
    const { token } = await autenticar();

    const mimeInvalido = await request(app)
      .post('/api/cartazes/imagens/presign')
      .set('Authorization', `Bearer ${token}`)
      .send({ mimeType: 'application/pdf', tamanhoBytes: 1000 });
    expect(mimeInvalido.status).toBe(422);

    const tamanhoAcima = await request(app)
      .post('/api/cartazes/imagens/presign')
      .set('Authorization', `Bearer ${token}`)
      .send({ mimeType: 'image/jpeg', tamanhoBytes: 13 * 1024 * 1024 });
    expect(tamanhoAcima.status).toBe(422);
  });

  it('presign com projetoId inexistente devolve 404', async () => {
    const { token } = await autenticar();

    const res = await request(app)
      .post('/api/cartazes/imagens/presign')
      .set('Authorization', `Bearer ${token}`)
      .send({ projetoId: '11111111-1111-1111-1111-111111111111', mimeType: 'image/jpeg', tamanhoBytes: 1000 });
    expect(res.status).toBe(404);
  });

  it('confirma um upload (HEAD confere no R2) e o arquivo aparece no projeto', async () => {
    const { token } = await autenticar();
    const projetoId = await criarProjeto(token);

    const presign = await request(app)
      .post('/api/cartazes/imagens/presign')
      .set('Authorization', `Bearer ${token}`)
      .send({ projetoId, mimeType: 'image/png', tamanhoBytes: 500_000 });

    const confirmar = await request(app)
      .post(`/api/cartazes/imagens/${presign.body.arquivoId}/confirmar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ projetoId });
    expect(confirmar.status).toBe(200);
    expect(confirmar.body.status).toBe('confirmado');

    const projeto = await request(app).get(`/api/cartazes/projetos/${projetoId}`).set('Authorization', `Bearer ${token}`);
    expect(projeto.body.arquivos).toHaveLength(1);
    expect(projeto.body.arquivos[0].id).toBe(presign.body.arquivoId);
    expect(projeto.body.arquivos[0].url).toContain('download=1');
  });

  it('recusa confirmar quando o upload ainda não chegou ao R2 (HEAD não encontra o objeto)', async () => {
    const { token } = await autenticar();
    const projetoId = await criarProjeto(token);
    const presign = await request(app)
      .post('/api/cartazes/imagens/presign')
      .set('Authorization', `Bearer ${token}`)
      .send({ projetoId, mimeType: 'image/jpeg', tamanhoBytes: 200_000 });

    verificarObjetoEnviadoMock.mockResolvedValueOnce(null);

    const confirmar = await request(app)
      .post(`/api/cartazes/imagens/${presign.body.arquivoId}/confirmar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ projetoId });
    expect(confirmar.status).toBe(409);

    const projeto = await request(app).get(`/api/cartazes/projetos/${projetoId}`).set('Authorization', `Bearer ${token}`);
    expect(projeto.body.arquivos).toHaveLength(0);
  });

  it('upload em lote: se 1 de 3 arquivos falha ao confirmar, os outros 2 continuam confirmados e vinculados', async () => {
    const { token } = await autenticar();
    const projetoId = await criarProjeto(token, 'planilha', 'Lote de 3');

    const presigns = await Promise.all(
      [0, 1, 2].map(() =>
        request(app)
          .post('/api/cartazes/imagens/presign')
          .set('Authorization', `Bearer ${token}`)
          .send({ projetoId, mimeType: 'image/jpeg', tamanhoBytes: 100_000 }),
      ),
    );

    // O segundo simula falha de rede/upload (HEAD não encontra o objeto no R2).
    // Confirmações em sequência (não Promise.all) pra garantir que a ordem das
    // respostas do mock corresponda 1:1 à ordem esperada — concorrência real
    // de upload é testada no nível do front (fila com progresso), não aqui.
    verificarObjetoEnviadoMock
      .mockResolvedValueOnce({ tamanhoBytes: 100_000 })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ tamanhoBytes: 100_000 });

    const resultados = [];
    for (const p of presigns) {
      resultados.push(
        // eslint-disable-next-line no-await-in-loop
        await request(app)
          .post(`/api/cartazes/imagens/${p.body.arquivoId}/confirmar`)
          .set('Authorization', `Bearer ${token}`)
          .send({ projetoId }),
      );
    }

    expect(resultados[0].status).toBe(200);
    expect(resultados[1].status).toBe(409);
    expect(resultados[2].status).toBe(200);

    const projeto = await request(app).get(`/api/cartazes/projetos/${projetoId}`).set('Authorization', `Bearer ${token}`);
    expect(projeto.body.arquivos).toHaveLength(2);

    // Retry do que falhou: confirma de novo (o PUT real teria sido refeito antes disso no front).
    const retry = await request(app)
      .post(`/api/cartazes/imagens/${presigns[1].body.arquivoId}/confirmar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ projetoId });
    expect(retry.status).toBe(200);

    const projetoAposRetry = await request(app).get(`/api/cartazes/projetos/${projetoId}`).set('Authorization', `Bearer ${token}`);
    expect(projetoAposRetry.body.arquivos).toHaveLength(3);
  });

  it('remove uma imagem confirmada (apaga do R2 e some do projeto)', async () => {
    const { token } = await autenticar();
    const projetoId = await criarProjeto(token);
    const presign = await request(app)
      .post('/api/cartazes/imagens/presign')
      .set('Authorization', `Bearer ${token}`)
      .send({ projetoId, mimeType: 'image/jpeg', tamanhoBytes: 100_000 });
    await request(app).post(`/api/cartazes/imagens/${presign.body.arquivoId}/confirmar`).set('Authorization', `Bearer ${token}`).send({ projetoId });

    const remocao = await request(app).delete(`/api/cartazes/imagens/${presign.body.arquivoId}`).set('Authorization', `Bearer ${token}`);
    expect(remocao.status).toBe(204);

    const projeto = await request(app).get(`/api/cartazes/projetos/${projetoId}`).set('Authorization', `Bearer ${token}`);
    expect(projeto.body.arquivos).toHaveLength(0);
  });

  it('não deixa uma organização confirmar ou remover a imagem de outra', async () => {
    const { token: tokenA } = await autenticar();
    const { token: tokenB } = await autenticar();
    const projetoIdA = await criarProjeto(tokenA);
    const presign = await request(app)
      .post('/api/cartazes/imagens/presign')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ projetoId: projetoIdA, mimeType: 'image/jpeg', tamanhoBytes: 100_000 });

    const confirmarPelaOutra = await request(app)
      .post(`/api/cartazes/imagens/${presign.body.arquivoId}/confirmar`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ projetoId: projetoIdA });
    expect(confirmarPelaOutra.status).toBe(404);

    const removerPelaOutra = await request(app).delete(`/api/cartazes/imagens/${presign.body.arquivoId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(removerPelaOutra.status).toBe(404);
  });

  it('confirma um upload sem projeto (caso de "produtos recentes") — fica confirmado, sem projetoId', async () => {
    const { token } = await autenticar();
    const presign = await request(app)
      .post('/api/cartazes/imagens/presign')
      .set('Authorization', `Bearer ${token}`)
      .send({ mimeType: 'image/jpeg', tamanhoBytes: 100_000 });

    const confirmar = await request(app)
      .post(`/api/cartazes/imagens/${presign.body.arquivoId}/confirmar`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(confirmar.status).toBe(200);
    expect(confirmar.body.status).toBe('confirmado');
  });

  it('busca URLs em lote de arquivos confirmados (miniaturas de recentes), ignorando ids de outra organização', async () => {
    const { token: tokenA } = await autenticar();
    const { token: tokenB } = await autenticar();

    const presignA = await request(app)
      .post('/api/cartazes/imagens/presign')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ mimeType: 'image/jpeg', tamanhoBytes: 100_000 });
    await request(app).post(`/api/cartazes/imagens/${presignA.body.arquivoId}/confirmar`).set('Authorization', `Bearer ${tokenA}`).send({});

    const presignB = await request(app)
      .post('/api/cartazes/imagens/presign')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ mimeType: 'image/jpeg', tamanhoBytes: 100_000 });
    await request(app).post(`/api/cartazes/imagens/${presignB.body.arquivoId}/confirmar`).set('Authorization', `Bearer ${tokenB}`).send({});

    const res = await request(app)
      .post('/api/cartazes/imagens/urls')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ids: [presignA.body.arquivoId, presignB.body.arquivoId] });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(presignA.body.arquivoId);
    expect(res.body[0].url).toContain('download=1');
  });

  it('duplica um arquivo confirmado sem projeto (caso de "produtos recentes") pra um projeto novo — sem afetar o original', async () => {
    const { token } = await autenticar();
    const presign = await request(app)
      .post('/api/cartazes/imagens/presign')
      .set('Authorization', `Bearer ${token}`)
      .send({ mimeType: 'image/jpeg', tamanhoBytes: 100_000 });
    await request(app).post(`/api/cartazes/imagens/${presign.body.arquivoId}/confirmar`).set('Authorization', `Bearer ${token}`).send({});

    const projetoId = await criarProjeto(token, 'panfleto', 'Panfleto que reaproveita recente');
    const duplicado = await request(app)
      .post(`/api/cartazes/imagens/${presign.body.arquivoId}/duplicar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ projetoId });

    expect(duplicado.status).toBe(201);
    expect(duplicado.body.id).not.toBe(presign.body.arquivoId);
    expect(duplicado.body.url).toContain('download=1');

    const projeto = await request(app).get(`/api/cartazes/projetos/${projetoId}`).set('Authorization', `Bearer ${token}`);
    expect(projeto.body.arquivos).toHaveLength(1);
    expect(projeto.body.arquivos[0].id).toBe(duplicado.body.id);
  });

  it('duplicar um arquivo já vinculado a OUTRO projeto não tira a foto do projeto original', async () => {
    const { token } = await autenticar();
    const projetoOrigemId = await criarProjeto(token, 'story', 'Story original');
    const presign = await request(app)
      .post('/api/cartazes/imagens/presign')
      .set('Authorization', `Bearer ${token}`)
      .send({ projetoId: projetoOrigemId, mimeType: 'image/jpeg', tamanhoBytes: 100_000 });
    await request(app)
      .post(`/api/cartazes/imagens/${presign.body.arquivoId}/confirmar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ projetoId: projetoOrigemId });

    const projetoDestinoId = await criarProjeto(token, 'panfleto', 'Panfleto que reaproveita');
    const duplicado = await request(app)
      .post(`/api/cartazes/imagens/${presign.body.arquivoId}/duplicar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ projetoId: projetoDestinoId });
    expect(duplicado.status).toBe(201);

    const origem = await request(app).get(`/api/cartazes/projetos/${projetoOrigemId}`).set('Authorization', `Bearer ${token}`);
    expect(origem.body.arquivos).toHaveLength(1);
    expect(origem.body.arquivos[0].id).toBe(presign.body.arquivoId);

    const destino = await request(app).get(`/api/cartazes/projetos/${projetoDestinoId}`).set('Authorization', `Bearer ${token}`);
    expect(destino.body.arquivos).toHaveLength(1);
    expect(destino.body.arquivos[0].id).toBe(duplicado.body.id);
  });

  it('recusa duplicar um arquivo que ainda não foi confirmado', async () => {
    const { token } = await autenticar();
    const projetoId = await criarProjeto(token);
    const presign = await request(app)
      .post('/api/cartazes/imagens/presign')
      .set('Authorization', `Bearer ${token}`)
      .send({ mimeType: 'image/jpeg', tamanhoBytes: 100_000 });

    const res = await request(app)
      .post(`/api/cartazes/imagens/${presign.body.arquivoId}/duplicar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ projetoId });
    expect(res.status).toBe(404);
  });

  it('não deixa uma organização duplicar arquivo de outra, nem duplicar pra projeto de outra', async () => {
    const { token: tokenA } = await autenticar();
    const { token: tokenB } = await autenticar();

    const presignA = await request(app)
      .post('/api/cartazes/imagens/presign')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ mimeType: 'image/jpeg', tamanhoBytes: 100_000 });
    await request(app).post(`/api/cartazes/imagens/${presignA.body.arquivoId}/confirmar`).set('Authorization', `Bearer ${tokenA}`).send({});
    const projetoB = await criarProjeto(tokenB);

    const duplicarArquivoDeOutraOrg = await request(app)
      .post(`/api/cartazes/imagens/${presignA.body.arquivoId}/duplicar`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ projetoId: projetoB });
    expect(duplicarArquivoDeOutraOrg.status).toBe(404);

    const duplicarProOutraOrg = await request(app)
      .post(`/api/cartazes/imagens/${presignA.body.arquivoId}/duplicar`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ projetoId: projetoB });
    expect(duplicarProOutraOrg.status).toBe(404);
  });

  it('rejeita sem estar autenticado', async () => {
    const res = await request(app).post('/api/cartazes/imagens/presign').send({ mimeType: 'image/jpeg', tamanhoBytes: 1000 });
    expect(res.status).toBe(401);
  });
});
