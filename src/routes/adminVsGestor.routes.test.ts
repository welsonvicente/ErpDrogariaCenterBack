import request from 'supertest';
import { createApp } from '../app';
import { PerfilUsuario } from '../models/Usuario';
import { _resetLoginRateLimit } from '../middlewares/rateLimitMiddleware';
import { resetDb } from '../tests/helpers/db';
import { criarFuncionario, criarOrganizacao, criarAdmin, gerarToken } from '../tests/helpers/factory';

/**
 * Separação entre ADMIN (dono da conta da organização) e GERENTE (opera o dia a dia).
 *
 * Antes os dois eram idênticos: passavam pelo mesmo `requireGerente` e nenhuma
 * rota distinguia um do outro. Isso deixava um GERENTE gravar código+PIN na conta
 * do ADMIN e entrar como ele, ou simplesmente excluí-la — o item 4 da auditoria.
 */
describe('ADMIN x GERENTE', () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDb();
    await _resetLoginRateLimit();
  });

  async function cenario() {
    const org = await criarOrganizacao({ slug: `org-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
    const admin = await criarAdmin(org.id, { email: `admin-${Math.random().toString(36).slice(2, 7)}@x.local` });
    const gerente = await criarFuncionario(org.id, { codigo: 'ges', perfil: PerfilUsuario.GERENTE, pinForte: true });
    const funcionario = await criarFuncionario(org.id, { codigo: 'fun' });
    return { org, admin, gerente, funcionario, tokenGestor: gerarToken(gerente), tokenAdmin: gerarToken(admin) };
  }

  describe('o ataque do item 4', () => {
    it('GERENTE não grava código+PIN na conta do ADMIN pra entrar como ele', async () => {
      const { admin, tokenGestor } = await cenario();

      const res = await request(app)
        .put(`/api/usuarios/${admin.id}`)
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({ codigo: 'invadido', pin: '999999' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/administrador/i);
    });

    it('GERENTE não exclui nem inativa a conta do ADMIN', async () => {
      const { admin, tokenGestor } = await cenario();

      expect((await request(app).delete(`/api/usuarios/${admin.id}`).set('Authorization', `Bearer ${tokenGestor}`)).status).toBe(403);
      expect(
        (await request(app).delete(`/api/usuarios/${admin.id}/permanente`).set('Authorization', `Bearer ${tokenGestor}`)).status,
      ).toBe(403);
    });

    it('GERENTE também não mexe em outro GERENTE', async () => {
      const { org, tokenGestor } = await cenario();
      const outroGestor = await criarFuncionario(org.id, { codigo: 'ges2', perfil: PerfilUsuario.GERENTE, pinForte: true });

      const res = await request(app)
        .put(`/api/usuarios/${outroGestor.id}`)
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({ nome: 'Renomeado' });

      expect(res.status).toBe(403);
    });
  });

  describe('o que o GERENTE continua podendo', () => {
    it('gerencia funcionários normalmente', async () => {
      const { funcionario, tokenGestor } = await cenario();

      const res = await request(app)
        .put(`/api/usuarios/${funcionario.id}`)
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({ nome: 'Nome Novo' });

      expect(res.status).toBe(200);
      expect(res.body.nome).toBe('Nome Novo');
    });

    it('vê o dashboard de despesas', async () => {
      const { tokenGestor } = await cenario();
      expect((await request(app).get('/api/despesas').set('Authorization', `Bearer ${tokenGestor}`)).status).toBe(200);
    });
  });

  describe('o que passou a ser só do ADMIN', () => {
    it('GERENTE não edita os dados da organização', async () => {
      const { tokenGestor } = await cenario();

      const res = await request(app)
        .put('/api/organizacao')
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({ nome: 'Nome Trocado Pelo Gerente' });

      expect(res.status).toBe(403);
    });

    it('ADMIN edita os dados da organização', async () => {
      const { tokenAdmin } = await cenario();

      const res = await request(app)
        .put('/api/organizacao')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ nome: 'Nome Trocado Pelo Admin' });

      expect(res.status).toBe(200);
    });

    it('ADMIN mexe em conta de gestão', async () => {
      const { gerente, tokenAdmin } = await cenario();

      const res = await request(app)
        .put(`/api/usuarios/${gerente.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ nome: 'Gerente Renomeado' });

      expect(res.status).toBe(200);
    });

    it('FUNCIONARIO comum não chega nem perto', async () => {
      const { funcionario } = await cenario();
      const token = gerarToken(funcionario);

      expect((await request(app).put('/api/organizacao').set('Authorization', `Bearer ${token}`).send({ nome: 'X' })).status).toBe(403);
    });
  });

  describe('a organização nunca fica sem administrador', () => {
    it('não deixa excluir o último ADMIN ativo', async () => {
      const { admin, tokenAdmin } = await cenario();

      const res = await request(app)
        .delete(`/api/usuarios/${admin.id}/permanente`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/único|unica|única/i);
    });

    it('não deixa inativar o último ADMIN ativo', async () => {
      const { admin, tokenAdmin } = await cenario();

      expect((await request(app).delete(`/api/usuarios/${admin.id}`).set('Authorization', `Bearer ${tokenAdmin}`)).status).toBe(409);
    });

    it('com dois ADMINs, dá pra remover um', async () => {
      const { org, admin, tokenAdmin } = await cenario();
      await criarAdmin(org.id, { email: `admin2-${Math.random().toString(36).slice(2, 7)}@x.local` });

      expect((await request(app).delete(`/api/usuarios/${admin.id}`).set('Authorization', `Bearer ${tokenAdmin}`)).status).toBe(204);
    });
  });
});
