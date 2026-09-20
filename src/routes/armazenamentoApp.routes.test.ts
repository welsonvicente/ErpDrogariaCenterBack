import request from 'supertest';
import { createApp } from '../app';
import { resetDb } from '../tests/helpers/db';
import { criarAdmin, criarFuncionario, criarOrganizacao, gerarToken } from '../tests/helpers/factory';

describe('/api/armazenamento/:chave — concorrência otimista', () => {
  const app = createApp();
  beforeEach(resetDb);

  it('primeira gravação (versaoEsperada 0) cria o registro com versão 1', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const token = gerarToken(admin);

    const res = await request(app)
      .put('/api/armazenamento/chave-teste')
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: JSON.stringify({ ok: true }), versaoEsperada: 0 });

    expect(res.status).toBe(200);
    expect(res.body.versao).toBe(1);
  });

  it('grava normalmente quando a versão esperada bate com a atual', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const token = gerarToken(admin);

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
    const admin = await criarAdmin(org.id);
    const token = gerarToken(admin);

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
    const admin = await criarAdmin(org.id);
    const token = gerarToken(admin);

    const res = await request(app).get('/api/armazenamento/chave-inexistente').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valor: null, versao: 0 });
  });
});

function dataFutura(dias: number) {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function estadoFolgas(usuarioId: string) {
  return {
    employees: [
      { id: 'emp-proprio', usuarioId, name: 'Funcionário Teste' },
      { id: 'emp-outro', usuarioId: 'outro-usuario', name: 'Outra Pessoa' },
    ],
    credits: [{ id: 'cred-1', employeeId: 'emp-proprio', workedDate: '2026-09-06', note: '', createdAt: new Date().toISOString() }],
    daysOff: [],
    leaves: [
      {
        id: 'leave-existente',
        employeeId: 'emp-proprio',
        type: 'atestado',
        startDate: '2026-09-01',
        endDate: '2026-09-02',
        note: 'Motivo sigiloso',
        submittedBy: 'colaborador',
        createdAt: new Date().toISOString(),
      },
    ],
    creditSwaps: [],
    blockedDates: [],
    blockedWeekdays: [],
    auditLog: [],
  };
}

describe('/api/armazenamento/:chave — autorização por papel', () => {
  const app = createApp();
  beforeEach(resetDb);

  it('impede funcionário de ler ou gravar uma chave genérica', async () => {
    const org = await criarOrganizacao();
    const funcionario = await criarFuncionario(org.id);
    const token = gerarToken(funcionario);

    const leitura = await request(app).get('/api/armazenamento/chave-interna').set('Authorization', `Bearer ${token}`);
    const gravacao = await request(app)
      .put('/api/armazenamento/chave-interna')
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: JSON.stringify({ ataque: true }), versaoEsperada: 0 });

    expect(leitura.status).toBe(403);
    expect(gravacao.status).toBe(403);
  });

  it('permite funcionário agendar a própria folga e registrar o próprio atestado sem expor a nota antiga', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const funcionario = await criarFuncionario(org.id);
    const tokenAdmin = gerarToken(admin);
    const tokenFuncionario = gerarToken(funcionario);
    const inicial = estadoFolgas(funcionario.id);

    await request(app)
      .put('/api/armazenamento/drogaria-center-folgas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ valor: JSON.stringify(inicial), versaoEsperada: 0 });

    const leitura = await request(app)
      .get('/api/armazenamento/drogaria-center-folgas')
      .set('Authorization', `Bearer ${tokenFuncionario}`);
    expect(leitura.status).toBe(200);
    const alterado = JSON.parse(leitura.body.valor);
    expect(alterado.leaves[0].note).not.toBe('Motivo sigiloso');
    delete alterado._acessoRestrito;
    alterado.daysOff.push({
      id: 'off-novo',
      employeeId: 'emp-proprio',
      date: dataFutura(10),
      createdAt: new Date().toISOString(),
    });
    alterado.leaves.push({
      id: 'leave-novo',
      employeeId: 'emp-proprio',
      type: 'atestado',
      startDate: dataFutura(20),
      endDate: dataFutura(21),
      note: 'Novo motivo informado pelo próprio colaborador',
      submittedBy: 'colaborador',
      createdAt: new Date().toISOString(),
    });

    const gravacao = await request(app)
      .put('/api/armazenamento/drogaria-center-folgas')
      .set('Authorization', `Bearer ${tokenFuncionario}`)
      .send({ valor: JSON.stringify(alterado), versaoEsperada: leitura.body.versao });
    expect(gravacao.status).toBe(200);

    const leituraAdmin = await request(app)
      .get('/api/armazenamento/drogaria-center-folgas')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    const persistido = JSON.parse(leituraAdmin.body.valor);
    expect(persistido.daysOff).toHaveLength(1);
    expect(persistido.leaves).toHaveLength(2);
    expect(persistido.leaves[0].note).toBe('Motivo sigiloso');
  });

  it('impede funcionário de criar crédito ou agendar folga para outra pessoa', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const funcionario = await criarFuncionario(org.id);
    const tokenAdmin = gerarToken(admin);
    const tokenFuncionario = gerarToken(funcionario);
    const inicial = estadoFolgas(funcionario.id);

    await request(app)
      .put('/api/armazenamento/drogaria-center-folgas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ valor: JSON.stringify(inicial), versaoEsperada: 0 });

    const leitura = await request(app)
      .get('/api/armazenamento/drogaria-center-folgas')
      .set('Authorization', `Bearer ${tokenFuncionario}`);
    const comCreditoForjado = JSON.parse(leitura.body.valor);
    delete comCreditoForjado._acessoRestrito;
    comCreditoForjado.credits.push({ id: 'cred-forjado', employeeId: 'emp-proprio', workedDate: dataFutura(1) });

    const credito = await request(app)
      .put('/api/armazenamento/drogaria-center-folgas')
      .set('Authorization', `Bearer ${tokenFuncionario}`)
      .send({ valor: JSON.stringify(comCreditoForjado), versaoEsperada: leitura.body.versao });
    expect(credito.status).toBe(403);

    const paraOutraPessoa = JSON.parse(leitura.body.valor);
    delete paraOutraPessoa._acessoRestrito;
    paraOutraPessoa.daysOff.push({
      id: 'off-forjado',
      employeeId: 'emp-outro',
      date: dataFutura(10),
      createdAt: new Date().toISOString(),
    });
    const folga = await request(app)
      .put('/api/armazenamento/drogaria-center-folgas')
      .set('Authorization', `Bearer ${tokenFuncionario}`)
      .send({ valor: JSON.stringify(paraOutraPessoa), versaoEsperada: leitura.body.versao });
    expect(folga.status).toBe(403);

    const leituraAdmin = await request(app)
      .get('/api/armazenamento/drogaria-center-folgas')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(JSON.parse(leituraAdmin.body.valor)).toEqual(inicial);
  });
});
