import {
  emitirTokenElevacao,
  estaElevado,
  identificarFuncionario,
  normalizarSenhasDePapel,
  ocultarSenhasDePapel,
  protegerGravacao,
  redigirEstado,
  verificarCredencial,
} from './FolgasSigiloService';

const ORG_ID = 'org-1';
const CHAVE = 'drogaria-center-folgas';

function estadoExemplo(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    employees: [{ id: 'emp-1', name: 'Kátia', code: '8', role: 'Supervisor' }],
    leaves: [
      { id: 'leave-1', employeeId: 'emp-1', type: 'atestado', startDate: '2026-09-01', endDate: '2026-09-02', note: 'Gripe forte' },
      { id: 'leave-2', employeeId: 'emp-1', type: 'ferias', startDate: '2026-10-01', endDate: '2026-10-10', note: null },
    ],
    rolePasswords: { Supervisor: '11111', Gerência: '45595', CEO: '99999' },
    credits: [],
    daysOff: [],
    creditSwaps: [],
    blockedDates: [],
    blockedWeekdays: [],
    auditLog: [],
    ...overrides,
  });
}

describe('FolgasSigiloService', () => {
  describe('redigirEstado', () => {
    it('remove rolePasswords e marca _acessoRestrito', () => {
      const redigido = JSON.parse(redigirEstado(estadoExemplo()));
      expect(redigido.rolePasswords).toBeUndefined();
      expect(redigido._acessoRestrito).toBe(true);
    });

    it('substitui a nota de atestados por um aviso, sem tocar em outros tipos de licença', () => {
      const redigido = JSON.parse(redigirEstado(estadoExemplo()));
      const atestado = redigido.leaves.find((l: any) => l.id === 'leave-1');
      const ferias = redigido.leaves.find((l: any) => l.id === 'leave-2');
      expect(atestado.note).not.toBe('Gripe forte');
      expect(atestado.note).toMatch(/gerente/i);
      expect(ferias.note).toBeNull(); // não é atestado — não deveria ser mexido
    });

    it('não derruba a chamada se o valor não for JSON válido', () => {
      expect(redigirEstado('isso não é json')).toBe('isso não é json');
    });
  });

  describe('verificarCredencial', () => {
    it('aceita a senha certa de um papel e devolve o nome do papel', async () => {
      const papel = await verificarCredencial(estadoExemplo(), { tipo: 'papel', senha: '99999' });
      expect(papel).toBe('CEO');
    });

    it('rejeita senha errada', async () => {
      const papel = await verificarCredencial(estadoExemplo(), { tipo: 'papel', senha: '00000' });
      expect(papel).toBeNull();
    });

    it('aceita senha de papel já migrada pra hash bcrypt', async () => {
      const estado = await normalizarSenhasDePapel(null, estadoExemplo());
      expect(JSON.parse(estado).rolePasswords.CEO).not.toBe('99999'); // guardada como hash

      expect(await verificarCredencial(estado, { tipo: 'papel', senha: '99999' })).toBe('CEO');
      expect(await verificarCredencial(estado, { tipo: 'papel', senha: '00000' })).toBeNull();
    });

    it('aceita um funcionário promovido com o código certo', async () => {
      const papel = await verificarCredencial(estadoExemplo(), {
        tipo: 'funcionario',
        funcionarioId: 'emp-1',
        codigo: '8',
      });
      expect(papel).toBe('Supervisor');
    });

    it('rejeita funcionário promovido com código errado', async () => {
      const papel = await verificarCredencial(estadoExemplo(), {
        tipo: 'funcionario',
        funcionarioId: 'emp-1',
        codigo: 'errado',
      });
      expect(papel).toBeNull();
    });

    it('rejeita quando não há estado salvo ainda', async () => {
      const papel = await verificarCredencial(null, { tipo: 'papel', senha: '99999' });
      expect(papel).toBeNull();
    });

    it('não eleva com um funcionário SEM cargo, mesmo com o código certo', async () => {
      const estado = estadoExemplo({ employees: [{ id: 'emp-2', name: 'João', code: '9' }] });
      const papel = await verificarCredencial(estado, { tipo: 'funcionario', funcionarioId: 'emp-2', codigo: '9' });
      expect(papel).toBeNull();
    });
  });

  // Regressão do achado crítico: `employees[].code` é metade da credencial
  // aceita em /elevar (a outra metade, o id, vem no mesmo objeto). Enquanto ele
  // voltava na resposta de GET, qualquer funcionário autenticado lia o código de
  // um colega promovido e se elevava sem saber senha nenhuma.
  describe('redigirEstado + verificarCredencial (bypass de elevação)', () => {
    it('não devolve o código dos colaboradores pra quem não elevou', () => {
      const redigido = JSON.parse(redigirEstado(estadoExemplo()));
      expect(redigido.employees[0].code).toBeUndefined();
      // O resto do cadastro continua visível — a ferramenta precisa dele.
      expect(redigido.employees[0].name).toBe('Kátia');
      expect(redigido.employees[0].role).toBe('Supervisor');
    });

    it('o que sobra na resposta redigida não é suficiente pra se elevar', async () => {
      const redigido = JSON.parse(redigirEstado(estadoExemplo()));
      const alvo = redigido.employees[0];

      const papel = await verificarCredencial(estadoExemplo(), {
        tipo: 'funcionario',
        funcionarioId: alvo.id,
        codigo: String(alvo.code), // "undefined" — é tudo que o atacante tem
      });
      expect(papel).toBeNull();
    });
  });

  describe('ocultarSenhasDePapel', () => {
    it('não devolve as senhas nem os hashes, mesmo pra quem elevou — só quais cargos têm senha', async () => {
      const guardado = await normalizarSenhasDePapel(null, estadoExemplo());
      const visivel = JSON.parse(ocultarSenhasDePapel(guardado));

      expect(Object.keys(visivel.rolePasswords).sort()).toEqual(['CEO', 'Gerência', 'Supervisor']);
      expect(Object.values(visivel.rolePasswords)).toEqual(['', '', '']);
      // O resto do estado passa intacto.
      expect(visivel.employees[0].code).toBe('8');
    });
  });

  describe('normalizarSenhasDePapel', () => {
    it('guarda senha nova como hash, nunca em texto puro', async () => {
      const resultado = JSON.parse(await normalizarSenhasDePapel(null, estadoExemplo()));
      expect(resultado.rolePasswords.CEO).toMatch(/^\$2[aby]\$/);
    });

    it('campo vazio significa "não mexer" — mantém a senha já salva', async () => {
      const anterior = await normalizarSenhasDePapel(null, estadoExemplo());
      const hashAnterior = JSON.parse(anterior).rolePasswords.CEO;

      // É isso que a tela manda de volta: ela nunca recebeu os valores.
      const doCliente = JSON.stringify({ ...JSON.parse(anterior), rolePasswords: { Supervisor: '', 'Gerência': '', CEO: '' } });
      const resultado = JSON.parse(await normalizarSenhasDePapel(anterior, doCliente));

      expect(resultado.rolePasswords.CEO).toBe(hashAnterior);
      expect(await verificarCredencial(JSON.stringify(resultado), { tipo: 'papel', senha: '99999' })).toBe('CEO');
    });

    it('troca de senha de um cargo não afeta os outros', async () => {
      const anterior = await normalizarSenhasDePapel(null, estadoExemplo());
      const doCliente = JSON.stringify({ ...JSON.parse(anterior), rolePasswords: { CEO: '12345' } });
      const resultado = await normalizarSenhasDePapel(anterior, doCliente);

      expect(await verificarCredencial(resultado, { tipo: 'papel', senha: '12345' })).toBe('CEO');
      expect(await verificarCredencial(resultado, { tipo: 'papel', senha: '99999' })).toBeNull();
      expect(await verificarCredencial(resultado, { tipo: 'papel', senha: '11111' })).toBe('Supervisor');
    });

    it('não re-hasheia um hash que o cliente devolveu', async () => {
      const anterior = await normalizarSenhasDePapel(null, estadoExemplo());
      const hashAnterior = JSON.parse(anterior).rolePasswords.CEO;
      const resultado = JSON.parse(await normalizarSenhasDePapel(anterior, anterior));
      expect(resultado.rolePasswords.CEO).toBe(hashAnterior);
    });
  });

  describe('identificarFuncionario', () => {
    it('resolve o código digitado sem nunca devolvê-lo de volta', () => {
      const encontrado = identificarFuncionario(estadoExemplo(), '8');
      expect(encontrado).toEqual({ id: 'emp-1', name: 'Kátia', role: 'Supervisor' });
      expect(encontrado).not.toHaveProperty('code');
    });

    it('devolve null pra código inexistente ou estado vazio', () => {
      expect(identificarFuncionario(estadoExemplo(), 'nao-existe')).toBeNull();
      expect(identificarFuncionario(null, '8')).toBeNull();
    });
  });

  describe('emitirTokenElevacao / estaElevado', () => {
    it('um token emitido pra uma chave/organização é válido só pra essa mesma combinação', () => {
      const token = emitirTokenElevacao(ORG_ID, CHAVE);
      expect(estaElevado(token, ORG_ID, CHAVE)).toBe(true);
      expect(estaElevado(token, 'outra-org', CHAVE)).toBe(false);
      expect(estaElevado(token, ORG_ID, 'outra-chave')).toBe(false);
    });

    it('token ausente, vazio ou lixo nunca é considerado elevado', () => {
      expect(estaElevado(undefined, ORG_ID, CHAVE)).toBe(false);
      expect(estaElevado('token-invalido', ORG_ID, CHAVE)).toBe(false);
    });
  });

  describe('protegerGravacao', () => {
    it('restaura rolePasswords a partir do estado anterior quando quem grava não elevou', () => {
      const anterior = estadoExemplo();
      // Cliente não-elevado nunca viu as senhas reais — o que ele manda de volta é lixo/ausente.
      const novoDoCliente = JSON.stringify({ ...JSON.parse(anterior), rolePasswords: {} });

      const resultado = JSON.parse(protegerGravacao(anterior, novoDoCliente));
      expect(resultado.rolePasswords).toEqual({ Supervisor: '11111', Gerência: '45595', CEO: '99999' });
    });

    it('restaura a nota real de um atestado já existente, mesmo se o cliente mandar a nota oculta de volta', () => {
      const anterior = estadoExemplo();
      const estadoAnteriorObj = JSON.parse(anterior);
      const novoDoCliente = JSON.stringify({
        ...estadoAnteriorObj,
        leaves: estadoAnteriorObj.leaves.map((l: any) =>
          l.id === 'leave-1' ? { ...l, note: '(detalhes visíveis só para quem tem acesso de gerente)' } : l,
        ),
      });

      const resultado = JSON.parse(protegerGravacao(anterior, novoDoCliente));
      const atestado = resultado.leaves.find((l: any) => l.id === 'leave-1');
      expect(atestado.note).toBe('Gripe forte');
    });

    it('mantém a nota de um atestado NOVO (o funcionário se autodeclarando é legítimo)', () => {
      const anterior = estadoExemplo();
      const estadoAnteriorObj = JSON.parse(anterior);
      const novoDoCliente = JSON.stringify({
        ...estadoAnteriorObj,
        leaves: [
          ...estadoAnteriorObj.leaves,
          { id: 'leave-novo', employeeId: 'emp-1', type: 'atestado', startDate: '2026-09-10', endDate: '2026-09-11', note: 'Dor nas costas' },
        ],
      });

      const resultado = JSON.parse(protegerGravacao(anterior, novoDoCliente));
      const novo = resultado.leaves.find((l: any) => l.id === 'leave-novo');
      expect(novo.note).toBe('Dor nas costas');
    });

    it('restaura o código dos colaboradores — quem não elevou nunca os viu, então não pode apagá-los', () => {
      const anterior = estadoExemplo();
      // É exatamente o que o cliente não-elevado devolve: a lista que ele recebeu, sem `code`.
      const novoDoCliente = redigirEstado(anterior);

      const resultado = JSON.parse(protegerGravacao(anterior, novoDoCliente));
      expect(resultado.employees[0].code).toBe('8');
    });

    it('remove o marcador _acessoRestrito antes de persistir (não é um campo de dado real)', () => {
      const anterior = estadoExemplo();
      const novoDoCliente = JSON.stringify({ ...JSON.parse(anterior), _acessoRestrito: true });
      const resultado = JSON.parse(protegerGravacao(anterior, novoDoCliente));
      expect(resultado._acessoRestrito).toBeUndefined();
    });
  });
});
