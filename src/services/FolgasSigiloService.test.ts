import { protegerGravacao, redigirEstado, validarAlteracaoDeFuncionario, validarFormatoEstado } from './FolgasSigiloService';

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

  describe('validarAlteracaoDeFuncionario', () => {
    it('rejeita alteração de campos administrativos', () => {
      const anterior = estadoExemplo({
        credits: [{ id: 'cred-1', employeeId: 'emp-1', workedDate: '2026-09-06' }],
      });
      const adulterado = JSON.parse(anterior);
      adulterado.credits.push({ id: 'cred-forjado', employeeId: 'emp-1', workedDate: '2026-09-13' });

      expect(validarAlteracaoDeFuncionario(anterior, JSON.stringify(adulterado), 'usuario-1')).toMatch(/administrativo/);
    });

    it('aceita ausência de listas antigas e a normalização do formato legado de dias bloqueados', () => {
      const anteriorObj = JSON.parse(estadoExemplo({ blockedWeekdays: [0] }));
      delete anteriorObj.creditSwaps;
      delete anteriorObj.auditLog;
      const novo = {
        ...anteriorObj,
        creditSwaps: [],
        auditLog: [],
        blockedWeekdays: [{ weekday: 0, by: null, at: null }],
      };

      expect(validarAlteracaoDeFuncionario(JSON.stringify(anteriorObj), JSON.stringify(novo), 'usuario-1')).toBeNull();
    });

    describe('pedido e cancelamento de folga', () => {
      // Datas relativas a hoje (fuso de São Paulo, o mesmo da validação).
      function diaRelativo(dias: number) {
        const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
        const data = new Date(`${hoje}T12:00:00Z`);
        data.setUTCDate(data.getUTCDate() + dias);
        return data.toISOString().slice(0, 10);
      }
      const credito = { id: 'cred-1', employeeId: 'emp-1', workedDate: '2026-09-06' };
      const comFolga = (folga: Record<string, unknown>) =>
        estadoExemplo({ leaves: [], credits: [credito], daysOff: [{ id: 'off-1', employeeId: 'emp-1', createdAt: '2026-10-01T10:00:00Z', ...folga }] });
      const semFolgas = (folgas: unknown[]) => {
        const obj = JSON.parse(estadoExemplo({ leaves: [], credits: [credito] }));
        obj.daysOff = folgas;
        return JSON.stringify(obj);
      };

      it('aceita um pedido novo pendente', () => {
        const anterior = semFolgas([]);
        const novo = semFolgas([{ id: 'off-1', employeeId: 'emp-1', date: diaRelativo(3), createdAt: new Date().toISOString(), status: 'pendente' }]);
        expect(validarAlteracaoDeFuncionario(anterior, novo, 'usuario-1')).toBeNull();
      });

      it('rejeita funcionário que tenta se autoaprovar', () => {
        const anterior = semFolgas([]);
        const novo = semFolgas([{ id: 'off-1', employeeId: 'emp-1', date: diaRelativo(3), createdAt: new Date().toISOString(), status: 'aprovada' }]);
        expect(validarAlteracaoDeFuncionario(anterior, novo, 'usuario-1')).toMatch(/aprovação da gerência/);
      });

      it('rejeita funcionário que tenta mudar a decisão de um pedido', () => {
        const anterior = comFolga({ date: diaRelativo(3), status: 'pendente' });
        const novo = comFolga({ date: diaRelativo(3), status: 'aprovada' });
        expect(validarAlteracaoDeFuncionario(anterior, novo, 'usuario-1')).toMatch(/não pode ser alterada/);
      });

      it('permite cancelar até a véspera', () => {
        expect(validarAlteracaoDeFuncionario(comFolga({ date: diaRelativo(1), status: 'aprovada' }), semFolgas([]), 'usuario-1')).toBeNull();
      });

      it.each([['no próprio dia', 0], ['depois do dia', -1]])('não permite cancelar %s', (_rotulo, dias) => {
        const anterior = comFolga({ date: diaRelativo(dias as number), status: 'aprovada' });
        expect(validarAlteracaoDeFuncionario(anterior, semFolgas([]), 'usuario-1')).toMatch(/até o dia anterior/);
      });

      it('folga recusada não ocupa a data nem consome o saldo', () => {
        const recusada = { id: 'off-1', employeeId: 'emp-1', date: diaRelativo(3), createdAt: '2026-10-01T10:00:00Z', status: 'recusada' };
        const anterior = semFolgas([recusada]);
        const novo = semFolgas([recusada, { id: 'off-2', employeeId: 'emp-1', date: diaRelativo(3), createdAt: new Date().toISOString(), status: 'pendente' }]);
        expect(validarAlteracaoDeFuncionario(anterior, novo, 'usuario-1')).toBeNull();
      });
    });

    it('rejeita quem tenta alterar ou excluir um afastamento existente', () => {
      const anterior = estadoExemplo();
      const adulterado = JSON.parse(anterior);
      adulterado.leaves = adulterado.leaves.filter((l: any) => l.id !== 'leave-1');

      expect(validarAlteracaoDeFuncionario(anterior, JSON.stringify(adulterado), 'usuario-1')).toMatch(/afastamentos existentes/);
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
