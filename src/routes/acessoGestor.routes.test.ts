import request from 'supertest';
import { createApp } from '../app';
import { AppDataSource } from '../config/data-source';
import { PerfilUsuario, Usuario } from '../models/Usuario';
import { _resetLoginRateLimit, _resetPinGestorRateLimit } from '../middlewares/rateLimitMiddleware';
import { resetDb } from '../tests/helpers/db';
import { criarAdmin, criarFuncionario, criarOrganizacao, gerarToken } from '../tests/helpers/factory';

/**
 * Acesso ao Painel do Gerente por quem entra pela porta rápida do balcão (código+PIN).
 *
 * Duas condições, conferidas no banco a cada requisição (ver
 * middlewares/authMiddleware.requireGerente): ter papel ADMIN/GERENTE E
 * ter um PIN definido pela própria pessoa (`pinForte`), já que um PIN de balcão
 * de 4 dígitos não protege o financeiro. Não existe PIN padrão em lugar nenhum.
 */
describe('Acesso ao Painel do Gerente por funcionário', () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDb();
    await _resetLoginRateLimit();
    await _resetPinGestorRateLimit();
  });

  async function cenario(overrides: Partial<Usuario> = {}) {
    const org = await criarOrganizacao({ slug: `org-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
    const funcionario = await criarFuncionario(org.id, { codigo: 'sup', ...overrides });
    return { org, funcionario, token: gerarToken(funcionario) };
  }

  const rotaDeGestor = (token: string) => request(app).get('/api/despesas').set('Authorization', `Bearer ${token}`);

  it('sem a permissão concedida, uma rota de gerente responde 403', async () => {
    const { token } = await cenario({ perfil: PerfilUsuario.FUNCIONARIO });
    expect((await rotaDeGestor(token)).status).toBe(403);
  });

  it('com a permissão mas sem PIN próprio definido, responde 428 dizendo qual passo falta', async () => {
    const { token } = await cenario({ perfil: PerfilUsuario.GERENTE, pinForte: false });

    const res = await rotaDeGestor(token);
    expect(res.status).toBe(428);
    expect(res.body.details).toEqual({ acao: 'DEFINIR_PIN_GESTOR' });
  });

  it('depois que a pessoa define o próprio PIN, o painel abre', async () => {
    const { token } = await cenario({ perfil: PerfilUsuario.GERENTE, pinForte: false });

    const definir = await request(app)
      .put('/api/perfil/pin-gerente')
      .set('Authorization', `Bearer ${token}`)
      .send({ pinAtual: '1234', novoPin: '654321' });
    expect(definir.status).toBe(204);

    expect((await rotaDeGestor(token)).status).toBe(200);
  });

  it('não deixa definir o PIN sem saber o atual — terminal de balcão fica destravado', async () => {
    const { token } = await cenario({ perfil: PerfilUsuario.GERENTE, pinForte: false });

    const res = await request(app)
      .put('/api/perfil/pin-gerente')
      .set('Authorization', `Bearer ${token}`)
      .send({ pinAtual: '0000', novoPin: '654321' });

    expect(res.status).toBe(401);
    expect((await rotaDeGestor(token)).status).toBe(428); // segue pendente
  });

  it('recusa PIN novo curto demais', async () => {
    const { token } = await cenario({ perfil: PerfilUsuario.GERENTE, pinForte: false });

    const res = await request(app)
      .put('/api/perfil/pin-gerente')
      .set('Authorization', `Bearer ${token}`)
      .send({ pinAtual: '1234', novoPin: '4321' });

    expect(res.status).toBe(422);
  });

  it('recusa quem não tem a permissão, mesmo sabendo o próprio PIN', async () => {
    const { token } = await cenario({ perfil: PerfilUsuario.FUNCIONARIO });

    const res = await request(app)
      .put('/api/perfil/pin-gerente')
      .set('Authorization', `Bearer ${token}`)
      .send({ pinAtual: '1234', novoPin: '654321' });

    expect(res.status).toBe(403);
  });

  it('revogar a permissão corta o acesso na hora, sem esperar o token vencer', async () => {
    const { funcionario, token } = await cenario({ perfil: PerfilUsuario.GERENTE, pinForte: true });
    expect((await rotaDeGestor(token)).status).toBe(200);

    await AppDataSource.getRepository(Usuario).update(funcionario.id, { perfil: PerfilUsuario.FUNCIONARIO });

    // Mesmo token de antes — a checagem vai ao banco, não ao payload do JWT.
    expect((await rotaDeGestor(token)).status).toBe(403);
  });

  it('inativar a pessoa também corta o acesso na hora', async () => {
    const { funcionario, token } = await cenario({ perfil: PerfilUsuario.GERENTE, pinForte: true });

    await AppDataSource.getRepository(Usuario).update(funcionario.id, { ativo: false });

    expect((await rotaDeGestor(token)).status).toBe(403);
  });

  it('gerente redefinindo o PIN da pessoa volta a exigir que ela escolha o dela', async () => {
    const { org, funcionario, token } = await cenario({ perfil: PerfilUsuario.GERENTE, pinForte: true });
    expect((await rotaDeGestor(token)).status).toBe(200);

    // Um PIN escolhido pelo gerente é um segredo que o gerente conhece — não serve
    // pra proteger o painel (ver UsuarioService.update).
    // Precisa ser ADMIN: desde a separação de papéis, um GERENTE não mexe em conta de gestão.
    const admin = await criarAdmin(org.id);
    const redefinir = await request(app)
      .put(`/api/usuarios/${funcionario.id}`)
      .set('Authorization', `Bearer ${gerarToken(admin)}`)
      .send({ pin: '987654' });
    expect(redefinir.status).toBe(200);

    expect((await rotaDeGestor(token)).status).toBe(428);
  });
});
