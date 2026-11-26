import request from 'supertest';
import { createApp } from '../app';
import { resetDb } from '../tests/helpers/db';
import { criarAdmin, criarFuncionario, criarOrganizacao, gerarToken } from '../tests/helpers/factory';

const linha = (codigo: string, extra: Record<string, unknown> = {}) => ({
  codigoTrier: codigo,
  produto: `PRODUTO ${codigo}`,
  saldo: 25,
  custoUnitario: 4.5,
  ...extra,
});

describe('/api/estoque', () => {
  const app = createApp();
  beforeEach(resetDb);

  async function contexto() {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    return { org, token: gerarToken(admin) };
  }

  async function importar(token: string, linhas: unknown[], modo = 'ATUALIZAR', nomeArquivo = 'parados.xlsx') {
    return request(app).post('/api/estoque/importacoes').set('Authorization', `Bearer ${token}`).send({ nomeArquivo, modo, totalLinhasLidas: linhas.length, linhas });
  }

  const painel = (token: string) => request(app).get('/api/estoque').set('Authorization', `Bearer ${token}`);

  it('importa o relatório e devolve números (não strings) e nulos para o que não veio', async () => {
    const { token } = await contexto();
    const res = await importar(token, [linha('100', { codigoBarras: '7891234567890', laboratorio: 'EMS', dataUltimaEntrada: '2025-03-10' })]);

    expect(res.status).toBe(201);
    expect(res.body.resumo).toMatchObject({ novos: 1, atualizados: 0, saiuDoRelatorio: 0 });
    expect(res.body.linhas).toBeUndefined();

    const { body } = await painel(token);
    expect(body.produtos).toHaveLength(1);
    expect(body.produtos[0]).toMatchObject({
      codigoTrier: '100',
      codigoBarras: '7891234567890',
      laboratorio: 'EMS',
      saldo: 25,
      custoUnitario: 4.5,
      dataUltimaEntrada: '2025-03-10',
      ativo: true,
      statusAcao: 'NAO_INICIADO',
    });
    // Campo que o relatório não trouxe fica nulo ("não informado"), nunca zero nem vazio.
    expect(body.produtos[0].fornecedor).toBeNull();
    expect(body.produtos[0].valorTotal).toBeNull();
    expect(body.config.faixas.p1Min).toBe(20);
  });

  it('atualizar: preserva plano de ação, observações e preço de venda e marca como fora do relatório quem não veio', async () => {
    const { token } = await contexto();
    await importar(token, [linha('1'), linha('2')]);
    const { body: antes } = await painel(token);
    const p1 = antes.produtos.find((p: { codigoTrier: string }) => p.codigoTrier === '1');

    await request(app)
      .patch(`/api/estoque/produtos/${p1.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statusAcao: 'EM_ANDAMENTO', observacoes: 'Montar kit', responsavel: 'Kátia', precoVenda: 12.9 });

    // Novo relatório: o 1 teve saldo alterado, o 2 sumiu, o 3 é novo.
    const res = await importar(token, [linha('1', { saldo: 8 }), linha('3')]);
    expect(res.body.resumo).toMatchObject({ novos: 1, atualizados: 1, saiuDoRelatorio: 1 });

    const { body } = await painel(token);
    const porCodigo = (c: string) => body.produtos.find((p: { codigoTrier: string }) => p.codigoTrier === c);
    expect(porCodigo('1')).toMatchObject({ saldo: 8, statusAcao: 'EM_ANDAMENTO', observacoes: 'Montar kit', responsavel: 'Kátia', precoVenda: 12.9, ativo: true });
    expect(porCodigo('2')).toMatchObject({ ativo: false });
    expect(porCodigo('3')).toMatchObject({ ativo: true, statusAcao: 'NAO_INICIADO' });
  });

  it('substituir: apaga o que existia, inclusive as ações', async () => {
    const { token } = await contexto();
    await importar(token, [linha('1'), linha('2')]);
    const { body: antes } = await painel(token);
    await request(app).patch(`/api/estoque/produtos/${antes.produtos[0].id}`).set('Authorization', `Bearer ${token}`).send({ observacoes: 'vai sumir' });

    const res = await importar(token, [linha('1')], 'SUBSTITUIR');
    expect(res.body.resumo).toMatchObject({ novos: 1, removidos: 2 });

    const { body } = await painel(token);
    expect(body.produtos).toHaveLength(1);
    expect(body.produtos[0].observacoes).toBeNull();
  });

  it('guarda o .xlsx original no banco e devolve idêntico no download (sem vazar o binário nas listagens)', async () => {
    const { token } = await contexto();
    const original = Buffer.concat([Buffer.from('PK\u0003\u0004'), Buffer.from([0, 1, 2, 250, 251, 252, 255])]);
    const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const res = await request(app)
      .post('/api/estoque/importacoes')
      .set('Authorization', `Bearer ${token}`)
      .send({ nomeArquivo: 'RELATÓRIO PARADOS.xlsx', modo: 'ATUALIZAR', totalLinhasLidas: 1, linhas: [linha('1')], arquivo: { mime, conteudoBase64: original.toString('base64') } });

    expect(res.status).toBe(201);
    expect(res.body.arquivoTamanho).toBe(original.length);
    expect(res.body.arquivoOriginal).toBeUndefined();

    const { body } = await painel(token);
    expect(body.importacoes[0].arquivoTamanho).toBe(original.length);
    expect(body.importacoes[0].arquivoOriginal).toBeUndefined();

    const download = await request(app).get(`/api/estoque/importacoes/${res.body.id}/arquivo`).set('Authorization', `Bearer ${token}`).buffer(true).parse((r, cb) => {
      const partes: Buffer[] = [];
      r.on('data', (c: Buffer) => partes.push(c));
      r.on('end', () => cb(null, Buffer.concat(partes)));
    });
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('spreadsheetml');
    expect(decodeURIComponent(download.headers['content-disposition'])).toContain('RELATÓRIO PARADOS.xlsx');
    expect(Buffer.compare(download.body as Buffer, original)).toBe(0);
  });

  it('download do arquivo: 404 sem arquivo guardado e 404 para outra organização', async () => {
    const a = await contexto();
    const b = await contexto();
    const sem = await importar(a.token, [linha('1')]);
    expect(sem.body.arquivoTamanho).toBeNull();
    expect((await request(app).get(`/api/estoque/importacoes/${sem.body.id}/arquivo`).set('Authorization', `Bearer ${a.token}`)).status).toBe(404);

    const com = await request(app)
      .post('/api/estoque/importacoes')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ nomeArquivo: 'x.xlsx', modo: 'ATUALIZAR', totalLinhasLidas: 1, linhas: [linha('2')], arquivo: { mime: 'application/octet-stream', conteudoBase64: Buffer.from('abc').toString('base64') } });
    expect((await request(app).get(`/api/estoque/importacoes/${com.body.id}/arquivo`).set('Authorization', `Bearer ${b.token}`)).status).toBe(404);
  });

  it('rejeita arquivo original acima do limite', async () => {
    const { token } = await contexto();
    const grande = Buffer.alloc(5 * 1024 * 1024 + 10, 1).toString('base64');
    const res = await request(app)
      .post('/api/estoque/importacoes')
      .set('Authorization', `Bearer ${token}`)
      .send({ nomeArquivo: 'grande.xlsx', modo: 'ATUALIZAR', totalLinhasLidas: 1, linhas: [linha('1')], arquivo: { mime: 'application/octet-stream', conteudoBase64: grande } });
    expect(res.status).toBe(422);
  });

  it('descarta código repetido no mesmo arquivo (a última ocorrência vence) e conta como ignorada', async () => {
    const { token } = await contexto();
    const res = await importar(token, [linha('9', { saldo: 1 }), linha('9', { saldo: 30 })]);
    expect(res.status).toBe(201);
    expect(res.body.resumo.ignoradas).toBe(1);
    const { body } = await painel(token);
    expect(body.produtos).toHaveLength(1);
    expect(body.produtos[0].saldo).toBe(30);
  });

  it('restaura uma importação anterior sem desfazer o plano de ação atual', async () => {
    const { token } = await contexto();
    const primeira = await importar(token, [linha('1', { saldo: 40 }), linha('2')]);
    await importar(token, [linha('1', { saldo: 3 })]);
    const { body: meio } = await painel(token);
    const p1 = meio.produtos.find((p: { codigoTrier: string }) => p.codigoTrier === '1');
    await request(app).patch(`/api/estoque/produtos/${p1.id}`).set('Authorization', `Bearer ${token}`).send({ observacoes: 'manter' });

    const res = await request(app).post(`/api/estoque/importacoes/${primeira.body.id}/restaurar`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.modo).toBe('RESTAURACAO');
    expect(res.body.restauradaDeId).toBe(primeira.body.id);

    const { body } = await painel(token);
    const porCodigo = (c: string) => body.produtos.find((p: { codigoTrier: string }) => p.codigoTrier === c);
    expect(porCodigo('1')).toMatchObject({ saldo: 40, observacoes: 'manter' });
    expect(porCodigo('2')).toMatchObject({ ativo: true });
    expect(body.importacoes).toHaveLength(3);
  });

  it('edita um produto, grava o histórico só dos campos que mudaram e marca a data da última atualização da ação', async () => {
    const { token } = await contexto();
    await importar(token, [linha('1')]);
    const { body: lista } = await painel(token);
    const id = lista.produtos[0].id;
    expect(lista.produtos[0].acaoAtualizadaEm).toBeNull();

    const res = await request(app)
      .patch(`/api/estoque/produtos/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statusAcao: 'CONCLUIDO', observacoes: '', prazo: '2025-12-31', quantidadeAtualizada: 4 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ statusAcao: 'CONCLUIDO', prazo: '2025-12-31', quantidadeAtualizada: 4, observacoes: null });
    expect(res.body.acaoAtualizadaEm).not.toBeNull();

    // Reenviar o mesmo valor não gera histórico novo.
    await request(app).patch(`/api/estoque/produtos/${id}`).set('Authorization', `Bearer ${token}`).send({ statusAcao: 'CONCLUIDO' });

    const acoes = await request(app).get('/api/estoque/historico?aba=acoes').set('Authorization', `Bearer ${token}`);
    expect(acoes.body).toHaveLength(1);
    expect(acoes.body[0]).toMatchObject({ campo: 'Status da ação', valorAnterior: 'NAO_INICIADO', valorNovo: 'CONCLUIDO', codigoTrier: '1' });

    const alteracoes = await request(app).get('/api/estoque/historico?aba=alteracoes').set('Authorization', `Bearer ${token}`);
    expect(alteracoes.body.map((h: { campo: string }) => h.campo).sort()).toEqual(['Prazo', 'Quantidade atualizada']);
  });

  it('edição em lote atualiza vários produtos e ignora ids de outra organização', async () => {
    const { token } = await contexto();
    const outra = await contexto();
    await importar(token, [linha('1'), linha('2')]);
    await importar(outra.token, [linha('1')]);
    const { body: minha } = await painel(token);
    const { body: alheia } = await painel(outra.token);

    const res = await request(app)
      .patch('/api/estoque/produtos/lote')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [...minha.produtos.map((p: { id: string }) => p.id), alheia.produtos[0].id], campos: { statusAcao: 'PLANEJADO', responsavel: 'Wesley' } });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((p: { statusAcao: string; responsavel: string }) => p.statusAcao === 'PLANEJADO' && p.responsavel === 'Wesley')).toBe(true);

    const { body: depois } = await painel(outra.token);
    expect(depois.produtos[0].statusAcao).toBe('NAO_INICIADO');
  });

  it('não deixa uma organização ver nem editar produto de outra', async () => {
    const a = await contexto();
    const b = await contexto();
    await importar(a.token, [linha('1')]);
    const { body } = await painel(a.token);

    expect((await painel(b.token)).body.produtos).toHaveLength(0);
    const res = await request(app).patch(`/api/estoque/produtos/${body.produtos[0].id}`).set('Authorization', `Bearer ${b.token}`).send({ observacoes: 'invasão' });
    expect(res.status).toBe(404);
  });

  it('salva a configuração e devolve mesclada com o padrão; rejeita faixas fora de ordem', async () => {
    const { token } = await contexto();
    const nova = {
      faixas: { p1Min: 30, p2Min: 15, p3Min: 6, p4Min: 1 },
      diasAlerta: 120,
      diasCritico: 300,
      estoqueElevadoMin: 60,
      margemMinimaPct: 25,
      pesos: { quantidade: 50, valor: 30, tempo: 20 },
      nomesGrupos: { '30': 'Suplementos', '2': 'Dermocosméticos' },
    };
    expect((await request(app).put('/api/estoque/config').set('Authorization', `Bearer ${token}`).send(nova)).status).toBe(200);
    expect((await painel(token)).body.config).toEqual(nova);
    // Config antiga/sem nomes de grupo continua válida: o campo assume vazio.
    const { nomesGrupos: _ignorado, ...semNomes } = nova;
    void _ignorado;
    const resposta = await request(app).put('/api/estoque/config').set('Authorization', `Bearer ${token}`).send(semNomes);
    expect(resposta.status).toBe(200);
    expect(resposta.body.nomesGrupos).toEqual({});

    const invalida = await request(app).put('/api/estoque/config').set('Authorization', `Bearer ${token}`).send({ ...nova, faixas: { p1Min: 5, p2Min: 10, p3Min: 6, p4Min: 1 } });
    expect(invalida.status).toBe(422);
  });

  it('guarda o período de entradas desconsideradas (fim aberto = até hoje) e rejeita período invertido', async () => {
    const { token } = await contexto();
    const base = (await painel(token)).body.config;

    const comPeriodo = await request(app).put('/api/estoque/config').set('Authorization', `Bearer ${token}`).send({ ...base, desconsiderarEntradas: { de: '2026-10-01', ate: null } });
    expect(comPeriodo.status).toBe(200);
    expect((await painel(token)).body.config.desconsiderarEntradas).toEqual({ de: '2026-10-01', ate: null });

    const vazio = await request(app).put('/api/estoque/config').set('Authorization', `Bearer ${token}`).send({ ...base, desconsiderarEntradas: { de: null, ate: null } });
    expect(vazio.body.desconsiderarEntradas).toBeNull();

    const invertido = await request(app).put('/api/estoque/config').set('Authorization', `Bearer ${token}`).send({ ...base, desconsiderarEntradas: { de: '2026-11-30', ate: '2026-10-01' } });
    expect(invertido.status).toBe(422);
  });

  it('valida a importação: sem produtos, sem código, data inválida', async () => {
    const { token } = await contexto();
    expect((await importar(token, [])).status).toBe(422);
    expect((await importar(token, [{ produto: 'sem código' }])).status).toBe(422);
    expect((await importar(token, [linha('1', { dataUltimaEntrada: '10/03/2025' })])).status).toBe(422);
  });

  it('só ADMIN/GERENTE acessa: funcionário recebe 403 e sem token recebe 401', async () => {
    const org = await criarOrganizacao();
    const funcionario = await criarFuncionario(org.id);
    const token = gerarToken(funcionario);

    expect((await request(app).get('/api/estoque').set('Authorization', `Bearer ${token}`)).status).toBe(403);
    expect((await importar(token, [linha('1')])).status).toBe(403);
    expect((await request(app).get('/api/estoque')).status).toBe(401);
  });
});
