/**
 * Migração de dados — Etapa 3 do PLANO-PAPEIS-E-ACESSO.md ("Unificar a
 * ferramenta de Folgas").
 *
 * `employees[]` do blob de Folgas (armazenamento genérico, chave
 * `drogaria-center-folgas`) deixa de ser um cadastro próprio (nome + código +
 * cargo) e passa a só referenciar um `usuarios` real da mesma organização
 * (`usuarioId`). Esse script casa cada colaborador existente com um usuário,
 * por código (mais preciso — código é único por organização) e, se não achar,
 * por nome (comparação sem acento/maiúsculas não feita de propósito — nome
 * digitado à mão diverge fácil; prefere reportar "não casou" a casar errado).
 *
 * SEMPRE roda em modo simulação primeiro (nenhuma gravação) — só grava com
 * `--aplicar`, depois de alguém conferir o relatório. Colaborador que não
 * casar fica com `usuarioId: null` (não é removido — os créditos/folgas/
 * licenças dele continuam referenciando o mesmo `employees[].id` de sempre;
 * apagar o cadastro órfão quebraria esse histórico). Alguém precisa vincular
 * esses manualmente depois (tela de Folgas, quando reescrita).
 *
 * Uso:
 *   npx ts-node scripts/migrar-folgas-employees.ts            # simula, só relatório
 *   npx ts-node scripts/migrar-folgas-employees.ts --aplicar  # grava de verdade
 */
import 'reflect-metadata';
import { AppDataSource } from '../src/config/data-source';
import { CHAVE_FOLGAS } from '../src/services/FolgasSigiloService';

interface EmployeeAntigo {
  id: string;
  name?: string;
  code?: string;
  role?: string;
  usuarioId?: string;
}

interface UsuarioLinha {
  id: string;
  nome: string;
  codigo: string | null;
}

function normalizarNome(nome: string | null | undefined): string {
  return (nome ?? '').trim().toLowerCase();
}

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  await AppDataSource.initialize();

  const registros: { id: string; organizacao_id: string; valor: string; org_nome: string; org_slug: string }[] = await AppDataSource.query(
    `SELECT aa.id, aa.organizacao_id, aa.valor, o.nome AS org_nome, o.slug AS org_slug
     FROM armazenamento_app aa
     JOIN organizacoes o ON o.id = aa.organizacao_id
     WHERE aa.chave = $1`,
    [CHAVE_FOLGAS],
  );

  console.log(`${registros.length} organização(ões) com dados de Folgas encontrada(s).`);
  if (!aplicar) {
    console.log('Modo SIMULAÇÃO — nada será gravado. Rode com --aplicar depois de conferir o relatório abaixo.\n');
  } else {
    console.log('Modo APLICAR — as mudanças serão gravadas no banco.\n');
  }

  let totalEmployees = 0;
  let totalCasados = 0;

  for (const registro of registros) {
    let estado: any;
    try {
      estado = JSON.parse(registro.valor);
    } catch {
      console.log(`[${registro.org_nome}] valor não é JSON válido — pulando (precisa de correção manual).`);
      continue;
    }

    const employees: EmployeeAntigo[] = Array.isArray(estado.employees) ? estado.employees : [];
    if (employees.length === 0) {
      console.log(`[${registro.org_nome}] sem colaboradores cadastrados no Folgas — nada a fazer.`);
      continue;
    }

    const usuarios: UsuarioLinha[] = await AppDataSource.query(`SELECT id, nome, codigo FROM usuarios WHERE organizacao_id = $1`, [
      registro.organizacao_id,
    ]);

    console.log(`\n=== ${registro.org_nome} (${registro.org_slug}) — ${employees.length} colaborador(es) no Folgas, ${usuarios.length} usuário(s) no ERP ===`);

    let casadosNestaOrg = 0;
    const novosEmployees = employees.map((emp) => {
      totalEmployees++;
      let usuario = emp.code ? usuarios.find((u) => u.codigo && u.codigo === emp.code) : undefined;
      let comoAchou = 'código';
      if (!usuario && emp.name) {
        usuario = usuarios.find((u) => normalizarNome(u.nome) === normalizarNome(emp.name));
        comoAchou = 'nome';
      }

      if (usuario) {
        casadosNestaOrg++;
        totalCasados++;
        console.log(`  OK    "${emp.name ?? '(sem nome)'}" (code=${emp.code ?? '—'}) -> "${usuario.nome}" (${usuario.id}) — casou por ${comoAchou}`);
      } else {
        console.log(`  ????  "${emp.name ?? '(sem nome)'}" (code=${emp.code ?? '—'}) — NÃO CASOU, precisa de vínculo manual depois`);
      }

      return { id: emp.id, name: emp.name, usuarioId: usuario ? usuario.id : null };
    });

    console.log(`  -> ${casadosNestaOrg}/${employees.length} casados automaticamente nesta organização.`);

    if (aplicar) {
      const { rolePasswords: _rolePasswords, ...resto } = estado;
      const novoValor = JSON.stringify({ ...resto, employees: novosEmployees });
      await AppDataSource.query(`UPDATE armazenamento_app SET valor = $1, versao = versao + 1 WHERE id = $2`, [novoValor, registro.id]);
      console.log('  -> gravado.');
    }
  }

  console.log(`\nTotal: ${totalCasados}/${totalEmployees} colaborador(es) casado(s) automaticamente em todas as organizações.`);
  if (!aplicar) {
    console.log('Nenhuma gravação foi feita (modo simulação). Confira o relatório acima e rode de novo com --aplicar.');
  }

  await AppDataSource.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
