import { isDeepStrictEqual } from 'node:util';

/**
 * A ferramenta de Folgas (public/tools/folgas-drogaria-center.html) guarda
 * TODO o estado da organização numa única chave do armazenamento genérico
 * (ver ArmazenamentoAppService) — incluindo dado sensível: o motivo de cada
 * atestado médico. A rota de armazenamento só exige "estar logado" (ver
 * armazenamentoApp.routes.ts) — quem decide se a pessoa é gerente é o
 * controller, checando o papel de verdade dela no ERP (ver
 * `verificarPoderDeGerente` em authMiddleware.ts).
 *
 * Além de esconder o motivo do atestado de quem não é gerente, este módulo
 * valida a diferença entre o estado anterior e o novo antes de aceitar uma
 * gravação de FUNCIONARIO. A ferramenta ainda salva um blob inteiro por
 * compatibilidade, então essa comparação é a barreira do servidor que impede
 * um funcionário de adulterar colaboradores, créditos, bloqueios, pagamentos
 * ou auditoria chamando o PUT diretamente.
 *
 * Antes da Etapa 3, existia aqui também: senhas de papel
 * (Supervisor/Gerência/CEO) com hash e comparação em tempo constante, um
 * mecanismo de "elevação" por token JWT próprio (sem vínculo com o usuário do
 * ERP), e resolução de colaborador por código digitado. Tudo isso foi
 * removido porque deixou de existir — `employees[]` agora referencia
 * `usuarios` reais da organização (`usuarioId`) e "ser gerente no Folgas" é
 * só "ser ADMIN/GERENTE no ERP".
 */
export const CHAVE_FOLGAS = 'drogaria-center-folgas';

const NOTA_OCULTA = '(detalhes visíveis só para quem tem acesso de gerente)';

function parseEstado(valorJson: string | null): any | null {
  if (!valorJson) return null;
  try {
    return JSON.parse(valorJson);
  } catch {
    return null;
  }
}

function objetosIguais(a: unknown, b: unknown): boolean {
  return isDeepStrictEqual(a, b);
}

function lista(estado: any, campo: string): any[] {
  return Array.isArray(estado?.[campo]) ? estado[campo] : [];
}

function mapaPorId(itens: any[]): Map<string, any> | null {
  const mapa = new Map<string, any>();
  for (const item of itens) {
    if (!item || typeof item.id !== 'string' || !item.id || mapa.has(item.id)) return null;
    mapa.set(item.id, item);
  }
  return mapa;
}

function dataIsoValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function hojeEmSaoPaulo(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const obter = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${obter('year')}-${obter('month')}-${obter('day')}`;
}

function diaDaSemana(dataIso: string): number {
  return new Date(`${dataIso}T12:00:00Z`).getUTCDay();
}

function valorAdministrativoComparavel(estado: any, chave: string): unknown {
  // Versões antigas do blob podem não ter as listas acrescentadas depois; o
  // cliente estático completa essas ausências com [] ao carregar. Isso não é
  // uma alteração administrativa real.
  const listasComPadraoVazio = ['employees', 'credits', 'creditSwaps', 'blockedDates', 'blockedWeekdays', 'auditLog'];
  if (!listasComPadraoVazio.includes(chave)) return estado[chave];

  const itens = lista(estado, chave);
  if (chave !== 'blockedWeekdays') return itens;

  // Migração de formato feita pelo cliente: antigamente era [0, 1], hoje é
  // [{weekday: 0, by: null, at: null}, ...]. As duas formas significam a mesma
  // coisa e não podem impedir um funcionário de salvar sua própria folga.
  return itens.map((item: any) =>
    typeof item === 'number' ? { weekday: item, by: null, at: null } : item,
  );
}

/** Oculta o motivo do atestado antes de devolver o estado pra quem não é gerente. */
export function redigirEstado(valorJson: string): string {
  const estado = parseEstado(valorJson);
  if (!estado) return valorJson; // não é JSON reconhecível — devolve como está, nada a redigir

  const leaves = Array.isArray(estado.leaves)
    ? estado.leaves.map((l: any) => (l?.type === 'atestado' && l?.note ? { ...l, note: NOTA_OCULTA } : l))
    : estado.leaves;

  return JSON.stringify({ ...estado, leaves, _acessoRestrito: true });
}

/**
 * Antes de gravar o que uma pessoa SEM acesso de gerente mandou, restaura o
 * motivo dos atestados já existentes a partir do que já estava salvo — ela
 * nunca viu os valores reais (ver `redigirEstado`), então o que veio de volta
 * nesse campo não pode sobrescrever o dado verdadeiro. Um atestado NOVO (sem
 * correspondente no estado anterior) mantém a nota mandada: é o próprio
 * funcionário se autodeclarando, legítimo.
 */
export function protegerGravacao(valorAnteriorJson: string | null, valorNovoJson: string): string {
  const novo = parseEstado(valorNovoJson);
  if (!novo) return valorNovoJson; // não é JSON reconhecível — o armazenamento genérico não valida schema, deixa passar

  const anterior = parseEstado(valorAnteriorJson) ?? {};
  delete novo._acessoRestrito;

  const leavesAnterioresPorId = new Map<string, any>((anterior.leaves || []).map((l: any) => [l.id, l]));
  if (Array.isArray(novo.leaves)) {
    novo.leaves = novo.leaves.map((l: any) => {
      if (l?.type !== 'atestado') return l;
      const original = leavesAnterioresPorId.get(l.id);
      return original ? { ...l, note: original.note } : l;
    });
  }

  return JSON.stringify(novo);
}

/**
 * Autoriza somente as duas operações que pertencem ao painel do funcionário:
 *  - adicionar/cancelar uma folga própria;
 *  - registrar um atestado próprio (atestados existentes não podem ser
 *    alterados nem excluídos pelo funcionário).
 *
 * O retorno é `null` quando a alteração é permitida ou uma mensagem segura
 * para resposta 403. O valor novo deve passar antes por `protegerGravacao`,
 * para que notas ocultas de atestados existentes já estejam restauradas.
 */
export function validarAlteracaoDeFuncionario(
  valorAnteriorJson: string | null,
  valorNovoProtegidoJson: string,
  usuarioId: string,
): string | null {
  const anterior = parseEstado(valorAnteriorJson);
  const novo = parseEstado(valorNovoProtegidoJson);
  if (!anterior || !novo) return 'Estado de Folgas inválido.';

  const colaborador = lista(anterior, 'employees').find((e: any) => e?.usuarioId === usuarioId);
  if (!colaborador || typeof colaborador.id !== 'string') {
    return 'Seu usuário não está vinculado a um colaborador da escala.';
  }

  // Fora as duas listas abaixo, todo o blob é administrativo e precisa voltar
  // exatamente como foi carregado. Campos futuros também nascem protegidos por
  // padrão, em vez de ficarem graváveis até alguém lembrar de adicioná-los aqui.
  const chaves = new Set([...Object.keys(anterior), ...Object.keys(novo)]);
  chaves.delete('daysOff');
  chaves.delete('leaves');
  chaves.delete('_acessoRestrito');
  for (const chave of chaves) {
    if (!objetosIguais(valorAdministrativoComparavel(anterior, chave), valorAdministrativoComparavel(novo, chave))) {
      return `Funcionários não podem alterar o campo administrativo "${chave}".`;
    }
  }

  const folgasAnteriores = lista(anterior, 'daysOff');
  const folgasNovas = lista(novo, 'daysOff');
  const folgasAnterioresPorId = mapaPorId(folgasAnteriores);
  const folgasNovasPorId = mapaPorId(folgasNovas);
  if (!folgasAnterioresPorId || !folgasNovasPorId) return 'A lista de folgas contém identificadores inválidos ou repetidos.';

  for (const folgaAnterior of folgasAnteriores) {
    const correspondente = folgasNovasPorId.get(folgaAnterior.id);
    if (!correspondente) {
      if (folgaAnterior.employeeId !== colaborador.id) return 'Você só pode cancelar uma folga própria.';
      continue;
    }
    if (!objetosIguais(folgaAnterior, correspondente)) return 'Uma folga existente não pode ser alterada.';
  }

  const adicionadas = folgasNovas.filter((folga: any) => !folgasAnterioresPorId.has(folga.id));
  for (const folga of adicionadas) {
    if (folga.employeeId !== colaborador.id) return 'Você só pode agendar uma folga para si mesmo.';
    if (!dataIsoValida(folga.date) || folga.date <= hojeEmSaoPaulo()) return 'A nova folga precisa ser agendada para uma data futura válida.';
    if (typeof folga.createdAt !== 'string' || Number.isNaN(Date.parse(folga.createdAt))) return 'A nova folga não tem uma data de criação válida.';

    const bloqueada = lista(anterior, 'blockedDates').some((b: any) => b?.date === folga.date);
    const diaBloqueado = lista(anterior, 'blockedWeekdays').some((b: any) =>
      (typeof b === 'number' ? b : b?.weekday) === diaDaSemana(folga.date),
    );
    if (bloqueada || diaBloqueado) return 'A data escolhida está bloqueada para folgas.';

    const emAfastamento = lista(novo, 'leaves').some(
      (l: any) => l?.employeeId === colaborador.id && dataIsoValida(l.startDate) && dataIsoValida(l.endDate) && folga.date >= l.startDate && folga.date <= l.endDate,
    );
    if (emAfastamento) return 'Não é possível agendar folga durante férias ou atestado.';

    const conflito = folgasNovas.some((outra: any) => outra?.id !== folga.id && outra?.date === folga.date);
    if (conflito) return 'Já existe uma folga agendada nessa data.';
  }

  const creditosDoColaborador = lista(anterior, 'credits').filter((c: any) => c?.employeeId === colaborador.id).length;
  const folgasDoColaborador = folgasNovas.filter((d: any) => d?.employeeId === colaborador.id).length;
  if (folgasDoColaborador > creditosDoColaborador) return 'Você não tem saldo suficiente para agendar essa folga.';

  const afastamentosAnteriores = lista(anterior, 'leaves');
  const afastamentosNovos = lista(novo, 'leaves');
  const afastamentosAnterioresPorId = mapaPorId(afastamentosAnteriores);
  const afastamentosNovosPorId = mapaPorId(afastamentosNovos);
  if (!afastamentosAnterioresPorId || !afastamentosNovosPorId) return 'A lista de afastamentos contém identificadores inválidos ou repetidos.';

  for (const afastamentoAnterior of afastamentosAnteriores) {
    const correspondente = afastamentosNovosPorId.get(afastamentoAnterior.id);
    if (!correspondente || !objetosIguais(afastamentoAnterior, correspondente)) {
      return 'Funcionários não podem alterar nem excluir afastamentos existentes.';
    }
  }

  const novosAtestados = afastamentosNovos.filter((afastamento: any) => !afastamentosAnterioresPorId.has(afastamento.id));
  for (const atestado of novosAtestados) {
    if (atestado.employeeId !== colaborador.id || atestado.type !== 'atestado') return 'Você só pode registrar um atestado para si mesmo.';
    if (!dataIsoValida(atestado.startDate) || !dataIsoValida(atestado.endDate) || atestado.endDate < atestado.startDate) {
      return 'O período do atestado é inválido.';
    }
    if (typeof atestado.note !== 'string' || !atestado.note.trim() || atestado.note.length > 2000) return 'O motivo do atestado é obrigatório e deve ter até 2.000 caracteres.';
    if (atestado.submittedBy !== 'colaborador') return 'O atestado precisa ser identificado como enviado pelo colaborador.';
    if (typeof atestado.createdAt !== 'string' || Number.isNaN(Date.parse(atestado.createdAt))) return 'O atestado não tem uma data de criação válida.';
  }

  return null;
}

/**
 * Formato mínimo aceitável do estado da ferramenta de Folgas — não valida o
 * conteúdo de cada item (isso continua sendo responsabilidade do cliente),
 * só garante que os campos conhecidos, quando presentes, são do tipo certo
 * (array). Isso é o suficiente pra barrar o caso real que importa: um bug no
 * cliente (ou uma gravação truncada) mandando algo como `employees: "oops"` —
 * um JSON tecnicamente válido, mas que quebraria a ferramenta pra QUALQUER
 * pessoa que carregasse esse estado depois, exigindo mexer direto no banco
 * pra corrigir.
 */
const CAMPOS_ARRAY_CONHECIDOS = ['employees', 'credits', 'daysOff', 'leaves', 'creditSwaps', 'blockedDates', 'blockedWeekdays', 'auditLog'] as const;

/** Devolve uma mensagem de erro se `valorJson` não tiver o formato mínimo esperado, ou `null` se estiver ok. */
export function validarFormatoEstado(valorJson: string): string | null {
  let estado: unknown;
  try {
    estado = JSON.parse(valorJson);
  } catch {
    return 'O valor não é um JSON válido.'; // defesa extra — já barrado antes pelo DTO genérico
  }

  if (typeof estado !== 'object' || estado === null) {
    return 'O valor precisa ser um objeto.';
  }

  for (const campo of CAMPOS_ARRAY_CONHECIDOS) {
    const valor = (estado as Record<string, unknown>)[campo];
    if (valor !== undefined && !Array.isArray(valor)) {
      return `Formato inválido no campo "${campo}": esperado uma lista.`;
    }
  }

  return null;
}
