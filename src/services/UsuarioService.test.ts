import { AppDataSource } from '../config/data-source';
import { RegistroAuditoria } from '../models/RegistroAuditoria';
import { PerfilUsuario } from '../models/Usuario';
import { criarAdmin, criarFuncionario, criarOrganizacao } from '../tests/helpers/factory';
import { resetDb } from '../tests/helpers/db';
import { UsuarioService } from './UsuarioService';

/**
 * Promover/rebaixar é a mudança mais sensível desta camada — decide quem enxerga
 * o financeiro. Fica registrada na auditoria, e só o ADMIN pode fazer.
 */
describe('UsuarioService.update — mudança de papel', () => {
  beforeEach(resetDb);

  const registros = () => AppDataSource.getRepository(RegistroAuditoria).find();

  it('registra na auditoria quando promove alguém a GERENTE', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const funcionario = await criarFuncionario(org.id, { nome: 'Welson', codigo: 'wel' });

    await UsuarioService.update(org.id, funcionario.id, admin.id, { perfil: PerfilUsuario.GERENTE }, true);

    const [registro, ...resto] = await registros();
    expect(resto).toHaveLength(0);
    expect(registro.acao).toBe('usuario.papel_promovido');
    expect(registro.detalhes).toContain('Welson');
    expect(registro.detalhes).toContain('GERENTE');
    expect(registro.usuarioNome).toBe(admin.nome);
  });

  it('registra o rebaixamento de volta pra FUNCIONARIO', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const gerente = await criarFuncionario(org.id, { codigo: 'ger', perfil: PerfilUsuario.GERENTE });

    await UsuarioService.update(org.id, gerente.id, admin.id, { perfil: PerfilUsuario.FUNCIONARIO }, true);

    const [registro] = await registros();
    expect(registro.acao).toBe('usuario.papel_rebaixado');
  });

  it('não registra nada quando o papel mandado é o que já era', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const gerente = await criarFuncionario(org.id, { codigo: 'ger', perfil: PerfilUsuario.GERENTE });

    await UsuarioService.update(org.id, gerente.id, admin.id, { perfil: PerfilUsuario.GERENTE, nome: 'Outro Nome' }, true);

    expect(await registros()).toHaveLength(0);
  });

  it('não registra nada numa edição que não mexe em papel', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const funcionario = await criarFuncionario(org.id);

    await UsuarioService.update(org.id, funcionario.id, admin.id, { nome: 'Novo Nome' }, true);

    expect(await registros()).toHaveLength(0);
  });

  it('um GERENTE não promove ninguém — nem a si mesmo', async () => {
    const org = await criarOrganizacao();
    const gerente = await criarFuncionario(org.id, { codigo: 'ger', perfil: PerfilUsuario.GERENTE });
    const funcionario = await criarFuncionario(org.id, { codigo: 'fun' });

    // `autorEhAdmin = false` é o que o controller passa pra quem não é ADMIN.
    await expect(
      UsuarioService.update(org.id, funcionario.id, gerente.id, { perfil: PerfilUsuario.GERENTE }, false),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(await registros()).toHaveLength(0);
  });

  it('promover zera o PIN forte — o painel só abre depois que a pessoa definir o dela', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const funcionario = await criarFuncionario(org.id, { codigo: 'fun', pinForte: true });

    const atualizado = await UsuarioService.update(org.id, funcionario.id, admin.id, { perfil: PerfilUsuario.GERENTE }, true);

    expect(atualizado.pinForte).toBe(false);
  });

  // O código é identificador de negócio, definido pela empresa — não tem regra de
  // tamanho, nem para quem tem papel de gestão. Quem protege a conta é o PIN e o
  // bloqueio por tentativas. Houve uma exigência de 3+ caracteres aqui que, além
  // de não comprar segurança, disparava em QUALQUER edição de uma conta de
  // gestão: redefinir o PIN de alguém com código curto era recusado.
  it('não barra por causa do tamanho do código — nem ao promover, nem ao redefinir PIN', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const funcionario = await criarFuncionario(org.id, { codigo: '13' });

    const promovido = await UsuarioService.update(org.id, funcionario.id, admin.id, { perfil: PerfilUsuario.GERENTE }, true);
    expect(promovido.perfil).toBe(PerfilUsuario.GERENTE);

    const comPinNovo = await UsuarioService.update(org.id, funcionario.id, admin.id, { pin: '987654' }, true);
    expect(comPinNovo.codigo).toBe('13');
  });

  it('não deixa rebaixar o último ADMIN — a organização ficaria sem dono', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);

    await expect(
      UsuarioService.update(org.id, admin.id, admin.id, { perfil: PerfilUsuario.GERENTE }, true),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
