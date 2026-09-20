/**
 * A ferramenta de Folgas (public/tools/folgas-drogaria-center.html) guarda
 * TODO o estado da organização numa única chave do armazenamento genérico
 * (ver ArmazenamentoAppService) — incluindo dado sensível: o motivo de cada
 * atestado médico. A rota de armazenamento só exige "estar logado" (ver
 * armazenamentoApp.routes.ts) — quem decide se a pessoa é gerente é o
 * controller, checando o papel de verdade dela no ERP (ver
 * `verificarPoderDeGerente` em authMiddleware.ts).
 *
 * Este módulo faz só uma coisa (bem menor do que fazia antes da unificação
 * dos papéis do Folgas com os do ERP — ver PLANO-PAPEIS-E-ACESSO.md, Etapa 3):
 * esconder o motivo do atestado de quem não é gerente, e restaurá-lo se essa
 * pessoa gravar o estado de volta sem tê-lo visto.
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
