import {
  emitirTokenElevacao,
  estaElevado,
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
      expect(atestado.note).toMatch(/gestor/i);
      expect(ferias.note).toBeNull(); // não é atestado — não deveria ser mexido
    });

    it('não derruba a chamada se o valor não for JSON válido', () => {
      expect(redigirEstado('isso não é json')).toBe('isso não é json');
    });
  });

  describe('verificarCredencial', () => {
    it('aceita a senha certa de um papel e devolve o nome do papel', () => {
      const papel = verificarCredencial(estadoExemplo(), { tipo: 'papel', senha: '99999' });
      expect(papel).toBe('CEO');
    });

    it('rejeita senha errada', () => {
      const papel = verificarCredencial(estadoExemplo(), { tipo: 'papel', senha: '00000' });
      expect(papel).toBeNull();
    });

    it('aceita um funcionário promovido com o código certo', () => {
      const papel = verificarCredencial(estadoExemplo(), {
        tipo: 'funcionario',
        funcionarioId: 'emp-1',
        codigo: '8',
      });
      expect(papel).toBe('Supervisor');
    });

    it('rejeita funcionário promovido com código errado', () => {
      const papel = verificarCredencial(estadoExemplo(), {
        tipo: 'funcionario',
        funcionarioId: 'emp-1',
        codigo: 'errado',
      });
      expect(papel).toBeNull();
    });

    it('rejeita quando não há estado salvo ainda', () => {
      const papel = verificarCredencial(null, { tipo: 'papel', senha: '99999' });
      expect(papel).toBeNull();
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
          l.id === 'leave-1' ? { ...l, note: '(detalhes visíveis só para quem tem acesso de gestor)' } : l,
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

    it('remove o marcador _acessoRestrito antes de persistir (não é um campo de dado real)', () => {
      const anterior = estadoExemplo();
      const novoDoCliente = JSON.stringify({ ...JSON.parse(anterior), _acessoRestrito: true });
      const resultado = JSON.parse(protegerGravacao(anterior, novoDoCliente));
      expect(resultado._acessoRestrito).toBeUndefined();
    });
  });
});
