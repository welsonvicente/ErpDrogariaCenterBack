import request from 'supertest';
import { createApp } from '../app';
import { resetDb } from '../tests/helpers/db';
import { criarAdmin, criarFuncionario, criarOrganizacao, gerarToken } from '../tests/helpers/factory';

const resumo = { veredito: 'REPROVADO', totalPedido: 1084.64, totalTrier: 1018.18, diferenca: -66.46, contagens: { OK: 17, DIVERGENCIA: 3, AUSENTE: 4, NAO_CONFIRMADO: 1, ATENCAO: 1, EXTRA: 4 } };

const corpo = (extra: Record<string, unknown> = {}) => ({
  titulo: 'Distribuidora X — pedido 1',
  pedido: {
    numero: 'PED-1',
    cotacao: 'COTAÇÃO 17/11',
    comprador: 'Farmácia Teste',
    compradorCnpj: null,
    distribuidora: 'Distribuidora X',
    representante: null,
    totalDeclarado: 119.85,
    minimoDistribuidora: 2,
    geradoEm: '17/11/2026 17:48',
    itens: [{ id: 1, ean: null, produto: 'ACETILCISTEINA XPE PED 100ML', qtd: 15, unitario: 7.99, subtotal: 119.85 }],
  },
  relatorio: {
    filial: 'FARMÁCIA TESTE',
    periodo: '18/11/2026 a 18/11/2026',
    fornecedor: 'VÁRIOS',
    emitidoEm: '19/11/2026 11:31:02',
    totalLiquido: 119.91,
    itens: [{ id: 1, codigo: '38639', produto: 'ACETILCISTEINA XPE PED 100ML', laboratorio: 'GEOLAB', grupo: '8', estoque: 15, qtd: 15, unitario: 7.99, bruto: 119.85, desconto: -0.06, liquido: 119.91, venda: 375 }],
  },
  decisoes: { '7': { tipo: 'confirmar' }, '8': { tipo: 'vincular', trierIds: [8] } },
  tolerancias: { arredondamento: 0.01, pequenoReais: 0.05, pequenoPct: 2 },
  resumo,
  ...extra,
});

describe('/api/criticas-pedido', () => {
  const app = createApp();
  beforeEach(resetDb);

  async function contexto() {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    return { org, token: gerarToken(admin) };
  }
  const post = (token: string, dados: unknown) => request(app).post('/api/criticas-pedido').set('Authorization', `Bearer ${token}`).send(dados as object);

  it('salva a crítica e a reabre idêntica (documentos lidos, decisões e tolerâncias)', async () => {
    const { token } = await contexto();
    const salvo = await post(token, corpo());
    expect(salvo.status).toBe(201);
    expect(salvo.body).toMatchObject({ titulo: 'Distribuidora X — pedido 1', distribuidora: 'Distribuidora X', numeroPedido: 'PED-1', veredito: 'REPROVADO', totalPedido: 1084.64, diferenca: -66.46, temPdfCota: false, temPdfTrier: false });
    expect(salvo.body.pdfCota).toBeUndefined();

    const aberto = await request(app).get(`/api/criticas-pedido/${salvo.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(aberto.status).toBe(200);
    expect(aberto.body.pedido.itens[0]).toEqual({ id: 1, ean: null, produto: 'ACETILCISTEINA XPE PED 100ML', qtd: 15, unitario: 7.99, subtotal: 119.85 });
    expect(aberto.body.relatorio.itens[0]).toMatchObject({ codigo: '38639', bruto: 119.85, desconto: -0.06 });
    expect(aberto.body.decisoes).toEqual({ '7': { tipo: 'confirmar' }, '8': { tipo: 'vincular', trierIds: [8] } });
    expect(aberto.body.tolerancias).toEqual({ arredondamento: 0.01, pequenoReais: 0.05, pequenoPct: 2 });
  });

  it('a listagem traz só o resumo (sem os documentos nem os PDFs), mais nova primeiro', async () => {
    const { token } = await contexto();
    await post(token, corpo({ titulo: 'Primeira' }));
    await post(token, corpo({ titulo: 'Segunda' }));
    const lista = await request(app).get('/api/criticas-pedido').set('Authorization', `Bearer ${token}`);
    expect(lista.status).toBe(200);
    expect(lista.body.map((c: { titulo: string }) => c.titulo)).toEqual(['Segunda', 'Primeira']);
    expect(lista.body[0].pedido).toBeUndefined();
    expect(lista.body[0].relatorio).toBeUndefined();
    expect(lista.body[0].contagens.OK).toBe(17);
  });

  it('guarda os PDFs originais e devolve idênticos no download', async () => {
    const { token } = await contexto();
    const cota = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from([0, 1, 2, 250, 251, 255])]);
    const trier = Buffer.from('%PDF-1.4 trier');
    const salvo = await post(token, corpo({ pdfCota: { nome: 'COTAÇÃO 17-11.pdf', conteudoBase64: cota.toString('base64') }, pdfTrier: { nome: 'G1.pdf', conteudoBase64: trier.toString('base64') } }));
    expect(salvo.body).toMatchObject({ temPdfCota: true, temPdfTrier: true, pdfCotaNome: 'COTAÇÃO 17-11.pdf' });

    const binario = (r: request.Request) =>
      r.buffer(true).parse((res, cb) => {
        const partes: Buffer[] = [];
        res.on('data', (c: Buffer) => partes.push(c));
        res.on('end', () => cb(null, Buffer.concat(partes)));
      });
    const baixouCota = await binario(request(app).get(`/api/criticas-pedido/${salvo.body.id}/pdf/cota`).set('Authorization', `Bearer ${token}`));
    expect(baixouCota.status).toBe(200);
    expect(baixouCota.headers['content-type']).toContain('application/pdf');
    expect(decodeURIComponent(baixouCota.headers['content-disposition'])).toContain('COTAÇÃO 17-11.pdf');
    expect(Buffer.compare(baixouCota.body as Buffer, cota)).toBe(0);
    const baixouTrier = await binario(request(app).get(`/api/criticas-pedido/${salvo.body.id}/pdf/trier`).set('Authorization', `Bearer ${token}`));
    expect(Buffer.compare(baixouTrier.body as Buffer, trier)).toBe(0);
  });

  it('PDF que não foi guardado responde 404', async () => {
    const { token } = await contexto();
    const salvo = await post(token, corpo());
    expect((await request(app).get(`/api/criticas-pedido/${salvo.body.id}/pdf/cota`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
  });

  it('atualiza decisões, tolerâncias e o resumo sem mexer nos documentos', async () => {
    const { token } = await contexto();
    const salvo = await post(token, corpo());
    const novoResumo = { ...resumo, veredito: 'APROVADO_COM_RESSALVAS', contagens: { OK: 18, ATENCAO: 2 } };
    const res = await request(app)
      .put(`/api/criticas-pedido/${salvo.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'Renomeada', decisoes: { '7': { tipo: 'rejeitar' } }, tolerancias: { arredondamento: 0.02, pequenoReais: 0.1, pequenoPct: 3 }, resumo: novoResumo });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ titulo: 'Renomeada', veredito: 'APROVADO_COM_RESSALVAS', decisoes: { '7': { tipo: 'rejeitar' } }, tolerancias: { arredondamento: 0.02, pequenoReais: 0.1, pequenoPct: 3 } });
    expect(res.body.pedido.itens).toHaveLength(1);
    expect(res.body.contagens).toEqual({ OK: 18, ATENCAO: 2 });
  });

  it('troca um documento: dados novos + PDF novo; sem PDF novo o antigo sai; o outro documento fica intacto', async () => {
    const { token } = await contexto();
    const pdf = (t: string) => ({ nome: `${t}.pdf`, conteudoBase64: Buffer.from(`%PDF ${t}`).toString('base64') });
    const salvo = await post(token, corpo({ pdfCota: pdf('cota-velha'), pdfTrier: pdf('trier-velho') }));
    const id = salvo.body.id;
    const put = (dados: object) => request(app).put(`/api/criticas-pedido/${id}`).set('Authorization', `Bearer ${token}`).send(dados);
    const base = { decisoes: {}, tolerancias: { arredondamento: 0.01, pequenoReais: 0.05, pequenoPct: 2 }, resumo };
    const novoPedido = { ...corpo().pedido, numero: 'PED-2', distribuidora: 'Distribuidora Y' };

    // 1) Troca o pedido enviando também o PDF novo.
    const trocou = await put({ ...base, pedido: novoPedido, pdfCota: pdf('cota-nova') });
    expect(trocou.status).toBe(200);
    expect(trocou.body).toMatchObject({ numeroPedido: 'PED-2', distribuidora: 'Distribuidora Y', pdfCotaNome: 'cota-nova.pdf', temPdfCota: true, temPdfTrier: true, pdfTrierNome: 'trier-velho.pdf' });
    expect(trocou.body.pedido.numero).toBe('PED-2');
    const baixou = await request(app).get(`/api/criticas-pedido/${id}/pdf/cota`).set('Authorization', `Bearer ${token}`).buffer(true).parse((res, cb) => {
      const partes: Buffer[] = [];
      res.on('data', (c: Buffer) => partes.push(c));
      res.on('end', () => cb(null, Buffer.concat(partes)));
    });
    expect((baixou.body as Buffer).toString()).toBe('%PDF cota-nova');

    // 2) Troca o relatório sem PDF novo: o PDF do Trier antigo sai, o do pedido continua.
    const semPdf = await put({ ...base, relatorio: { ...corpo().relatorio, periodo: '01/11/2026 a 02/11/2026' } });
    expect(semPdf.body).toMatchObject({ periodoTrier: '01/11/2026 a 02/11/2026', temPdfTrier: false, pdfTrierNome: null, temPdfCota: true });
    expect((await request(app).get(`/api/criticas-pedido/${id}/pdf/trier`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
    expect((await request(app).get(`/api/criticas-pedido/${id}/pdf/cota`).set('Authorization', `Bearer ${token}`)).status).toBe(200);

    // 3) Atualização comum (sem documentos) não mexe em nada disso.
    const comum = await put({ ...base, titulo: 'Só o nome' });
    expect(comum.body).toMatchObject({ numeroPedido: 'PED-2', temPdfCota: true, temPdfTrier: false });
  });

  it('guarda as anotações (motivo/observação por linha), reabre iguais e só muda quando vêm no corpo', async () => {
    const { token } = await contexto();
    const anotacoes = { c3: { motivo: 'URGENCIA', texto: 'Comprador pediu junto por falta' }, t7: { motivo: null, texto: 'Bonificação combinada' } };
    const salvo = await post(token, corpo({ anotacoes }));
    expect(salvo.status).toBe(201);
    const aberto = await request(app).get(`/api/criticas-pedido/${salvo.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(aberto.body.anotacoes).toEqual(anotacoes);

    const put = (dados: object) => request(app).put(`/api/criticas-pedido/${salvo.body.id}`).set('Authorization', `Bearer ${token}`).send({ decisoes: {}, tolerancias: corpo().tolerancias, resumo, ...dados });
    expect((await put({ titulo: 'Sem anotações no corpo' })).body.anotacoes).toEqual(anotacoes);
    expect((await put({ anotacoes: { c3: { motivo: 'OUTRO', texto: 'Ok' } } })).body.anotacoes).toEqual({ c3: { motivo: 'OUTRO', texto: 'Ok' } });
    expect((await put({ anotacoes: {} })).body.anotacoes).toEqual({});
    expect((await put({ anotacoes: { xyz: { motivo: null, texto: 'chave inválida' } } })).status).toBe(422);
  });

  it('PDF com vários pedidos: guarda a distribuidora de cada item e o resumo por pedido', async () => {
    const { token } = await contexto();
    const base = corpo();
    const pedido = {
      ...base.pedido,
      distribuidora: 'Várias (2): Dist A, Dist B',
      numero: 'PED-A +1',
      itens: [
        { id: 1, ean: null, produto: 'PRODUTO UM 10MG', qtd: 1, unitario: 2, subtotal: 2, distribuidora: 'Dist A', pedidoNumero: 'PED-A' },
        { id: 2, ean: null, produto: 'PRODUTO DOIS 5MG', qtd: 1, unitario: 3, subtotal: 3, distribuidora: 'Dist B', pedidoNumero: 'PED-B' },
      ],
      pedidos: [
        { numero: 'PED-A', distribuidora: 'Dist A', representante: 'Fulano', totalDeclarado: 2, minimoDistribuidora: null, itens: 1 },
        { numero: 'PED-B', distribuidora: 'Dist B', representante: null, totalDeclarado: 3, minimoDistribuidora: 10, itens: 1 },
      ],
    };
    const salvo = await post(token, { ...base, pedido });
    expect(salvo.status).toBe(201);
    const aberto = await request(app).get(`/api/criticas-pedido/${salvo.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(aberto.body.pedido.itens.map((i: { distribuidora: string; pedidoNumero: string }) => [i.distribuidora, i.pedidoNumero])).toEqual([['Dist A', 'PED-A'], ['Dist B', 'PED-B']]);
    expect(aberto.body.pedido.pedidos).toEqual(pedido.pedidos);
    expect(aberto.body.distribuidora).toBe('Várias (2): Dist A, Dist B');
  });

  it('exclui a crítica', async () => {
    const { token } = await contexto();
    const salvo = await post(token, corpo());
    expect((await request(app).delete(`/api/criticas-pedido/${salvo.body.id}`).set('Authorization', `Bearer ${token}`)).status).toBe(204);
    expect((await request(app).get(`/api/criticas-pedido/${salvo.body.id}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
    expect((await request(app).delete(`/api/criticas-pedido/${salvo.body.id}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
  });

  it('uma organização não vê, abre, baixa, altera nem exclui a crítica de outra', async () => {
    const a = await contexto();
    const b = await contexto();
    const salvo = await post(a.token, corpo({ pdfCota: { nome: 'a.pdf', conteudoBase64: Buffer.from('x').toString('base64') } }));
    const id = salvo.body.id;
    expect((await request(app).get('/api/criticas-pedido').set('Authorization', `Bearer ${b.token}`)).body).toHaveLength(0);
    expect((await request(app).get(`/api/criticas-pedido/${id}`).set('Authorization', `Bearer ${b.token}`)).status).toBe(404);
    expect((await request(app).get(`/api/criticas-pedido/${id}/pdf/cota`).set('Authorization', `Bearer ${b.token}`)).status).toBe(404);
    expect((await request(app).put(`/api/criticas-pedido/${id}`).set('Authorization', `Bearer ${b.token}`).send({ decisoes: {}, tolerancias: corpo().tolerancias, resumo })).status).toBe(404);
    expect((await request(app).delete(`/api/criticas-pedido/${id}`).set('Authorization', `Bearer ${b.token}`)).status).toBe(404);
    expect((await request(app).get(`/api/criticas-pedido/${id}`).set('Authorization', `Bearer ${a.token}`)).status).toBe(200);
  });

  it('valida: sem nome, sem itens, veredito inválido, PDF grande demais', async () => {
    const { token } = await contexto();
    expect((await post(token, corpo({ titulo: '  ' }))).status).toBe(422);
    expect((await post(token, corpo({ pedido: { ...corpo().pedido, itens: [] } }))).status).toBe(422);
    expect((await post(token, corpo({ resumo: { ...resumo, veredito: 'TALVEZ' } }))).status).toBe(422);
    const grande = Buffer.alloc(3 * 1024 * 1024 + 10, 1).toString('base64');
    expect((await post(token, corpo({ pdfTrier: { nome: 'g.pdf', conteudoBase64: grande } }))).status).toBe(422);
  });

  it('só ADMIN/GERENTE: funcionário recebe 403 e sem token 401', async () => {
    const org = await criarOrganizacao();
    const token = gerarToken(await criarFuncionario(org.id));
    expect((await request(app).get('/api/criticas-pedido').set('Authorization', `Bearer ${token}`)).status).toBe(403);
    expect((await post(token, corpo())).status).toBe(403);
    expect((await request(app).get('/api/criticas-pedido')).status).toBe(401);
  });
});
