import { protegerGravacao, redigirEstado, validarFormatoEstado } from './FolgasSigiloService';

function estadoExemplo(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    employees: [{ id: 'emp-1', usuarioId: 'usuario-1', name: 'Kátia' }],
    leaves: [
      { id: 'leave-1', employeeId: 'emp-1', type: 'atestado', startDate: '2026-09-01', endDate: '2026-09-02', note: 'Gripe forte' },
      { id: 'leave-2', employeeId: 'emp-1', type: 'ferias', startDate: '2026-10-01', endDate: '2026-10-10', note: null },
    ],
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
    it('marca _acessoRestrito', () => {
      const redigido = JSON.parse(redigirEstado(estadoExemplo()));
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

    it('não mexe no resto do cadastro do colaborador (nome, usuarioId continuam visíveis)', () => {
      const redigido = JSON.parse(redigirEstado(estadoExemplo()));
      expect(redigido.employees[0].name).toBe('Kátia');
      expect(redigido.employees[0].usuarioId).toBe('usuario-1');
    });

    it('não derruba a chamada se o valor não for JSON válido', () => {
      expect(redigirEstado('isso não é json')).toBe('isso não é json');
    });
  });

  describe('protegerGravacao', () => {
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

    it('remove o marcador _acessoRestrito antes de persistir (não é um campo de dado real)', () => {
      const anterior = estadoExemplo();
      const novoDoCliente = JSON.stringify({ ...JSON.parse(anterior), _acessoRestrito: true });
      const resultado = JSON.parse(protegerGravacao(anterior, novoDoCliente));
      expect(resultado._acessoRestrito).toBeUndefined();
    });

    it('não derruba a chamada se o valor novo não for JSON válido', () => {
      expect(protegerGravacao(estadoExemplo(), 'isso não é json')).toBe('isso não é json');
    });
  });

  describe('validarFormatoEstado', () => {
    it('aceita um estado bem formado', () => {
      expect(validarFormatoEstado(estadoExemplo())).toBeNull();
    });

    it('rejeita quando um campo conhecido não é uma lista', () => {
      const quebrado = JSON.stringify({ ...JSON.parse(estadoExemplo()), employees: 'oops' });
      expect(validarFormatoEstado(quebrado)).toMatch(/employees/);
    });

    it('rejeita JSON inválido', () => {
      expect(validarFormatoEstado('{')).toMatch(/JSON/);
    });

    it('aceita campos desconhecidos sem reclamar (formato pode evoluir sem exigir mudar aqui)', () => {
      const comCampoNovo = JSON.stringify({ ...JSON.parse(estadoExemplo()), algumCampoFuturo: { x: 1 } });
      expect(validarFormatoEstado(comCampoNovo)).toBeNull();
    });
  });
});
