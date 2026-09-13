/**
 * Categorias de despesa que toda organização nova já ganha pronta (seed e
 * cadastro público de organização usam a mesma lista, pra não desalinhar).
 *
 * `exigeBeneficiario`: quando true, lançar um gasto nessa categoria exige
 * escolher o colaborador que recebeu o valor (ver Categoria.exigeBeneficiario
 * e DespesaService.assertBeneficiario) — hoje só a diária de domingo/feriado.
 */
export const CATEGORIAS_PADRAO = [
  { nome: 'Combustível', icone: '⛽' },
  { nome: 'Manutenção da moto', icone: '🔧' },
  { nome: 'Óleo da moto', icone: '🛢️' },
  { nome: 'Material de limpeza', icone: '🧹' },
  { nome: 'Cabine de aplicação', icone: '🧴' },
  { nome: 'Uso e consumo e faxina', icone: '🧼' },
  { nome: 'Consumo interno - material de escritório', icone: '📎' },
  { nome: 'Uniformes', icone: '👕' },
  { nome: 'Embalagens e impressos', icone: '📦' },
  { nome: 'Produto avulso e valor', icone: '🏷️' },
  { nome: 'Entregador terceirizado', icone: '🛵' },
  { nome: 'Diária de domingo ou feriado', icone: '📅', exigeBeneficiario: true },
  { nome: 'Retirada de vitaminas ou produtos de campanha', icone: '💊' },
  { nome: 'Outros', icone: '✳️' },
];
