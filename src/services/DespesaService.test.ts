import { FormaPagamento } from '../models/Despesa';
import { criarCategoria, criarFuncionario, criarOrganizacao } from '../tests/helpers/factory';
import { resetDb } from '../tests/helpers/db';
import { DespesaService } from './DespesaService';

describe('DespesaService', () => {
  beforeEach(resetDb);

  async function montarCenario(categoriaOverrides: Record<string, unknown> = {}) {
    const org = await criarOrganizacao();
    const funcionario = await criarFuncionario(org.id);
    const beneficiario = await criarFuncionario(org.id, { nome: 'Beneficiário', codigo: 'BEN1' });
    const categoria = await criarCategoria(org.id, categoriaOverrides);
    return { org, funcionario, beneficiario, categoria };
  }

  describe('create', () => {
    it('lança uma despesa normalmente quando a categoria não exige beneficiário', async () => {
      const { org, funcionario, categoria } = await montarCenario();

      const despesa = await DespesaService.create(org.id, funcionario.id, {
        data: '2026-09-13',
        valor: 42.5,
        formaPagamento: FormaPagamento.DINHEIRO,
        categoriaId: categoria.id,
      });

      expect(despesa.valor).toBe('42.50');
      expect(despesa.usuarioId).toBe(funcionario.id);
      expect(despesa.beneficiarioId).toBeNull();
    });

    it('rejeita lançar sem beneficiário quando a categoria exige (ex.: Diária de domingo ou feriado)', async () => {
      const { org, funcionario, categoria } = await montarCenario({ exigeBeneficiario: true });

      await expect(
        DespesaService.create(org.id, funcionario.id, {
          data: '2026-09-13',
          valor: 100,
          formaPagamento: FormaPagamento.DINHEIRO,
          categoriaId: categoria.id,
        }),
      ).rejects.toThrow(/colaborador que vai receber/i);
    });

    it('aceita lançar com beneficiário quando a categoria exige', async () => {
      const { org, funcionario, beneficiario, categoria } = await montarCenario({ exigeBeneficiario: true });

      const despesa = await DespesaService.create(org.id, funcionario.id, {
        data: '2026-09-13',
        valor: 100,
        formaPagamento: FormaPagamento.DINHEIRO,
        categoriaId: categoria.id,
        beneficiarioId: beneficiario.id,
      });

      expect(despesa.beneficiarioId).toBe(beneficiario.id);
      expect(despesa.beneficiario?.nome).toBe('Beneficiário');
    });

    it('nunca vaza pinHash/senhaHash do usuário ou do beneficiário na resposta', async () => {
      const { org, funcionario, beneficiario, categoria } = await montarCenario({ exigeBeneficiario: true });

      const despesa: any = await DespesaService.create(org.id, funcionario.id, {
        data: '2026-09-13',
        valor: 10,
        formaPagamento: FormaPagamento.PIX,
        categoriaId: categoria.id,
        beneficiarioId: beneficiario.id,
      });

      expect(despesa.usuario.pinHash).toBeUndefined();
      expect(despesa.usuario.senhaHash).toBeUndefined();
      expect(despesa.beneficiario.pinHash).toBeUndefined();
    });
  });

  describe('update', () => {
    it('exige beneficiário ao trocar a categoria de uma despesa existente pra uma que exige', async () => {
      const { org, funcionario, categoria: categoriaSemExigencia } = await montarCenario();
      const categoriaComExigencia = await criarCategoria(org.id, { exigeBeneficiario: true });

      const despesa = await DespesaService.create(org.id, funcionario.id, {
        data: '2026-09-13',
        valor: 30,
        formaPagamento: FormaPagamento.DINHEIRO,
        categoriaId: categoriaSemExigencia.id,
      });

      await expect(
        DespesaService.update(org.id, despesa.id, funcionario.id, { categoriaId: categoriaComExigencia.id }),
      ).rejects.toThrow(/colaborador que vai receber/i);
    });

    it('mantém o beneficiário já existente quando a edição não toca nesse campo', async () => {
      const { org, funcionario, beneficiario, categoria } = await montarCenario({ exigeBeneficiario: true });
      const despesa = await DespesaService.create(org.id, funcionario.id, {
        data: '2026-09-13',
        valor: 100,
        formaPagamento: FormaPagamento.DINHEIRO,
        categoriaId: categoria.id,
        beneficiarioId: beneficiario.id,
      });

      const atualizada = await DespesaService.update(org.id, despesa.id, funcionario.id, { descricao: 'ajuste' });
      expect(atualizada.beneficiarioId).toBe(beneficiario.id);
      expect(atualizada.descricao).toBe('ajuste');
    });
  });

  describe('remove', () => {
    it('remove a despesa e registra na auditoria quem excluiu', async () => {
      const { org, funcionario, categoria } = await montarCenario();
      const despesa = await DespesaService.create(org.id, funcionario.id, {
        data: '2026-09-13',
        valor: 15,
        formaPagamento: FormaPagamento.DINHEIRO,
        categoriaId: categoria.id,
      });

      await DespesaService.remove(org.id, despesa.id, funcionario.id);

      await expect(DespesaService.getById(org.id, despesa.id)).rejects.toThrow();
    });
  });
});
