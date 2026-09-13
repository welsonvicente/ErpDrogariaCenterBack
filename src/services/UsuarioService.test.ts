import { AppDataSource } from '../config/data-source';
import { RegistroAuditoria } from '../models/RegistroAuditoria';
import { criarAdmin, criarFuncionario, criarOrganizacao } from '../tests/helpers/factory';
import { resetDb } from '../tests/helpers/db';
import { UsuarioService } from './UsuarioService';

describe('UsuarioService.update', () => {
  beforeEach(resetDb);

  it('registra na auditoria quando concede o atalho pro painel do gestor', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const funcionario = await criarFuncionario(org.id, { nome: 'Welson' });

    await UsuarioService.update(org.id, funcionario.id, admin.id, { podeAcessarGestor: true });

    const registros = await AppDataSource.getRepository(RegistroAuditoria).find({ where: { organizacaoId: org.id } });
    expect(registros).toHaveLength(1);
    expect(registros[0].acao).toBe('funcionario.acesso_gestor_concedido');
    expect(registros[0].detalhes).toBe('Welson');
    expect(registros[0].usuarioNome).toBe(admin.nome);
  });

  it('registra revogação quando o valor muda de true pra false', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const funcionario = await criarFuncionario(org.id, { podeAcessarGestor: true });

    await UsuarioService.update(org.id, funcionario.id, admin.id, { podeAcessarGestor: false });

    const registros = await AppDataSource.getRepository(RegistroAuditoria).find({ where: { organizacaoId: org.id } });
    expect(registros).toHaveLength(1);
    expect(registros[0].acao).toBe('funcionario.acesso_gestor_revogado');
  });

  it('não registra nada quando o valor não muda (ex.: manda true de novo pro que já era true)', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const funcionario = await criarFuncionario(org.id, { podeAcessarGestor: true });

    await UsuarioService.update(org.id, funcionario.id, admin.id, { podeAcessarGestor: true, nome: 'Welson Vicente' });

    const registros = await AppDataSource.getRepository(RegistroAuditoria).find({ where: { organizacaoId: org.id } });
    expect(registros).toHaveLength(0);
  });

  it('não registra nada numa edição que não mexe em podeAcessarGestor', async () => {
    const org = await criarOrganizacao();
    const admin = await criarAdmin(org.id);
    const funcionario = await criarFuncionario(org.id);

    await UsuarioService.update(org.id, funcionario.id, admin.id, { nome: 'Novo Nome' });

    const registros = await AppDataSource.getRepository(RegistroAuditoria).find({ where: { organizacaoId: org.id } });
    expect(registros).toHaveLength(0);
  });
});
