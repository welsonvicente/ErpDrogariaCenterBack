import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';

/**
 * A ferramenta de Folgas (public/tools/folgas-drogaria-center.html) guarda
 * TODO o estado da organização numa única chave do armazenamento genérico
 * (ver ArmazenamentoAppService) — incluindo dado sensível: as senhas de
 * papel (Supervisor/Gerência/CEO), o código de acesso de cada colaborador e
 * o motivo de cada atestado médico. A rota de armazenamento só exige "estar
 * logado" (não distingue perfil — ver armazenamentoApp.routes.ts), então sem
 * isso qualquer funcionário autenticado no PharmaMind conseguiria ler esses
 * dados direto pela API, sem nunca passar pela tela nem saber senha nenhuma
 * da ferramenta.
 *
 * Este módulo intercepta especificamente essa chave pra:
 *  1. Esconder os campos sensíveis de quem não "elevou" o acesso dentro
 *     da ferramenta (ver `redigirEstado`);
 *  2. Proteger gravações de quem não elevou, pra não sobrescrever esses
 *     campos com a versão incompleta que ela só enxergou (ver
 *     `protegerGravacao`);
 *  3. Guardar as senhas de papel como hash, nunca em texto puro (ver
 *     `normalizarSenhasDePapel`).
 *
 * "Elevar" significa provar, no endpoint dedicado (ArmazenamentoAppController.elevar),
 * que a pessoa sabe uma senha de papel válida ou é um funcionário
 * promovido (tem `role` no cadastro) — a checagem acontece no servidor,
 * comparando com o estado já salvo, sem nunca expor os valores reais
 * nessa checagem em si. Quem prova isso ganha um token de curta duração
 * pra usar nas próximas chamadas (cabeçalho HEADER_ELEVACAO).
 *
 * É uma exceção pontual e comentada dentro de um serviço que, fora isso,
 * continua genérico (guarda string opaca pra qualquer ferramenta) — não
 * generalizamos esse mecanismo de sigilo pra outras chaves porque só essa
 * ferramenta guarda dado sensível dentro de um blob de acesso amplo.
 */
export const CHAVE_FOLGAS = 'drogaria-center-folgas';
export const HEADER_ELEVACAO = 'x-elevacao-token';

const TIPO_TOKEN = 'armazenamento-elevacao';
const EXPIRA_EM = '30m';
const NOTA_OCULTA = '(detalhes visíveis só para quem tem acesso de gerente)';
const SALT_ROUNDS = 10;

interface ElevacaoPayload {
  tipo: typeof TIPO_TOKEN;
  organizacaoId: string;
  chave: string;
}

export function emitirTokenElevacao(organizacaoId: string, chave: string): string {
  const payload: ElevacaoPayload = { tipo: TIPO_TOKEN, organizacaoId, chave };
  return jwt.sign(payload, env.jwt.secret, { expiresIn: EXPIRA_EM });
}

export function estaElevado(token: string | undefined, organizacaoId: string, chave: string): boolean {
  if (!token) return false;
  try {
    const payload = jwt.verify(token, env.jwt.secret) as ElevacaoPayload;
    return payload.tipo === TIPO_TOKEN && payload.organizacaoId === organizacaoId && payload.chave === chave;
  } catch {
    return false;
  }
}

function parseEstado(valorJson: string | null): any | null {
  if (!valorJson) return null;
  try {
    return JSON.parse(valorJson);
  } catch {
    return null;
  }
}

/** Uma senha de papel já migrada está guardada como hash bcrypt, não em texto puro. */
function ehHashBcrypt(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\$2[aby]\$\d{2}\$/.test(valor);
}

/**
 * Comparação de strings em tempo constante — usada só no caminho legado
 * (senha de papel ainda em texto puro, gravada antes da migração pra hash).
 * Com `===` o tempo de resposta vaza quantos caracteres iniciais bateram,
 * o que reduz um ataque de força bruta a poucas tentativas por dígito.
 */
function comparaSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifica uma credencial contra o estado já salvo (nunca contra o que o
 * cliente diz que é verdade) — usada pelo endpoint de elevação. Devolve o
 * nome do papel concedido quando válida (o cliente não tem mais como saber
 * isso sozinho, já que rolePasswords fica oculto), ou `null` se inválida.
 *
 * Senhas de papel são comparadas com bcrypt. O ramo de texto puro existe só
 * pra não trancar do lado de fora quem já tinha senha gravada antes da
 * migração — esse valor vira hash sozinho na próxima gravação com acesso
 * elevado (ver `normalizarSenhasDePapel`).
 */
export async function verificarCredencial(
  valorJson: string | null,
  credencial: { tipo: 'papel'; senha: string } | { tipo: 'funcionario'; funcionarioId: string; codigo: string },
): Promise<string | null> {
  const estado = parseEstado(valorJson);
  if (!estado) return null;

  if (credencial.tipo === 'papel') {
    const papeis = estado.rolePasswords || {};
    for (const papel of Object.keys(papeis)) {
      const guardada = papeis[papel];
      if (typeof guardada !== 'string' || guardada === '') continue;

      const confere = ehHashBcrypt(guardada)
        ? await bcrypt.compare(credencial.senha, guardada)
        : comparaSeguro(credencial.senha, guardada);

      if (confere) return papel;
    }
    return null;
  }

  const funcionario = (estado.employees || []).find((e: any) => e.id === credencial.funcionarioId);
  if (!funcionario || !funcionario.role || typeof funcionario.code !== 'string') return null;
  if (!comparaSeguro(credencial.codigo, funcionario.code)) return null;
  return funcionario.role;
}

/**
 * Resolve o código digitado na tela de entrada da ferramenta para o
 * colaborador correspondente.
 *
 * Existe porque `employees[].code` deixou de ser devolvido pra quem não tem
 * acesso elevado (ver `redigirEstado`) — antes o cliente casava o código
 * digitado contra a lista que ele mesmo tinha em mãos, o que só funcionava
 * porque a lista vinha com todos os códigos dentro. Agora quem confere é o
 * servidor, e o cliente só descobre o colaborador cujo código a pessoa
 * realmente sabe.
 *
 * Devolve `null` quando não bate — a rota que chama isso é limitada por IP,
 * pra esse endpoint não virar um oráculo de força bruta de códigos.
 */
export function identificarFuncionario(valorJson: string | null, codigo: string) {
  const estado = parseEstado(valorJson);
  if (!estado) return null;

  const funcionario = (estado.employees || []).find(
    (e: any) => typeof e?.code === 'string' && comparaSeguro(codigo, e.code),
  );
  if (!funcionario) return null;

  // Só o necessário pra montar o painel dele — o código não volta (quem
  // perguntou já sabe, e devolvê-lo só criaria outra via de vazamento).
  return { id: funcionario.id, name: funcionario.name, role: funcionario.role ?? null };
}

/** Remove/oculta os campos sensíveis antes de devolver o estado pra quem não elevou o acesso. */
export function redigirEstado(valorJson: string): string {
  const estado = parseEstado(valorJson);
  if (!estado) return valorJson; // não é JSON reconhecível — devolve como está, nada a redigir

  const { rolePasswords, ...resto } = estado;

  const leaves = Array.isArray(estado.leaves)
    ? estado.leaves.map((l: any) => (l?.type === 'atestado' && l?.note ? { ...l, note: NOTA_OCULTA } : l))
    : estado.leaves;

  // `code` é a credencial de entrada do colaborador na ferramenta E metade da
  // credencial aceita em /elevar (junto do id, que está logo ao lado). Mandá-lo
  // pra quem não tem acesso elevado entregava, no mesmo payload, exatamente o
  // que era preciso pra se elevar: bastava pegar um colaborador com `role`
  // preenchido e repetir id + code de volta pro servidor.
  const employees = Array.isArray(estado.employees)
    ? estado.employees.map((e: any) => {
        const { code, ...semCodigo } = e ?? {};
        return semCodigo;
      })
    : estado.employees;

  // `_acessoRestrito: true` avisa o cliente que rolePasswords não está
  // simplesmente "ainda não configurado" (caso em que ele preencheria com
  // as senhas padrão) — está oculto de propósito.
  return JSON.stringify({ ...resto, employees, leaves, _acessoRestrito: true });
}

/**
 * Mesmo QUEM TEM acesso elevado não recebe as senhas de papel — só quais
 * cargos já têm senha definida (valor vazio = "definida, não mostrada").
 *
 * Mandar o hash bcrypt pro cliente elevado não seria tão ruim quanto texto
 * puro, mas ainda seria ruim: senha de papel são poucos dígitos, e um hash em
 * mãos é quebrável offline sem nenhum rate limit no caminho. A tela de gestão
 * não precisa exibir a senha atual — só trocar —, e `normalizarSenhasDePapel`
 * entende campo vazio como "mantém o que está salvo", então isso vai e volta
 * sem perder nada.
 */
export function ocultarSenhasDePapel(valorJson: string): string {
  const estado = parseEstado(valorJson);
  if (!estado) return valorJson;

  const papeis: Record<string, unknown> = estado.rolePasswords ?? {};
  const mascarado: Record<string, string> = {};
  for (const papel of Object.keys(papeis)) {
    const guardada = papeis[papel];
    if (typeof guardada === 'string' && guardada !== '') mascarado[papel] = '';
  }

  return JSON.stringify({ ...estado, rolePasswords: mascarado });
}

/**
 * Antes de gravar o que uma pessoa SEM acesso elevado mandou, restaura os
 * campos sensíveis a partir do que já estava salvo — ela nunca viu os
 * valores reais, então o que veio de volta nesses campos (ou a ausência
 * deles) não pode sobrescrever o dado verdadeiro. Atestados NOVOS (sem
 * correspondente no estado anterior) mantêm a nota mandada: é o próprio
 * funcionário se autodeclarando, legítimo.
 */
export function protegerGravacao(valorAnteriorJson: string | null, valorNovoJson: string): string {
  const novo = parseEstado(valorNovoJson);
  if (!novo) return valorNovoJson; // não é JSON reconhecível — o armazenamento genérico não valida schema, deixa passar

  const anterior = parseEstado(valorAnteriorJson) ?? {};

  novo.rolePasswords = anterior.rolePasswords ?? novo.rolePasswords ?? {};
  delete novo._acessoRestrito;

  // Mesmo motivo de `redigirEstado`: quem gravou não enxergava os códigos, então
  // o que voltou aqui (ausente) não pode apagar o código real de ninguém.
  // Cadastrar colaborador é ação de gerente, então um colaborador sem
  // correspondente anterior simplesmente fica sem código — não inventamos um.
  const anterioresPorId = new Map<string, any>((anterior.employees || []).map((e: any) => [e.id, e]));
  if (Array.isArray(novo.employees)) {
    novo.employees = novo.employees.map((e: any) => {
      const original = anterioresPorId.get(e?.id);
      return original ? { ...e, code: original.code } : e;
    });
  }

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
 * Antes de gravar o que uma pessoa COM acesso elevado mandou, converte as
 * senhas de papel pra hash bcrypt.
 *
 * Antes elas ficavam em texto puro dentro do blob — legíveis em qualquer dump
 * ou backup do banco. Como o cliente nunca mais recebe esses valores (ver
 * `redigirEstado`, que os remove pra todo mundo), o que chega aqui é de dois
 * tipos:
 *  - um valor novo em texto puro (a pessoa acabou de digitar) → vira hash;
 *  - um campo ausente/vazio (a tela não tinha o que exibir) → mantém o hash
 *    que já estava salvo, senão editar qualquer outra coisa apagaria a senha.
 *
 * É também o que migra, sozinho, as senhas antigas ainda em texto puro.
 */
export async function normalizarSenhasDePapel(valorAnteriorJson: string | null, valorNovoJson: string): Promise<string> {
  const novo = parseEstado(valorNovoJson);
  if (!novo) return valorNovoJson;

  const anterior = parseEstado(valorAnteriorJson) ?? {};
  const anteriores: Record<string, unknown> = anterior.rolePasswords ?? {};
  const recebidas: Record<string, unknown> = novo.rolePasswords ?? {};

  const papeis = new Set([...Object.keys(anteriores), ...Object.keys(recebidas)]);
  const resultado: Record<string, string> = {};

  for (const papel of papeis) {
    const recebida = recebidas[papel];
    const guardada = anteriores[papel];

    // Nada digitado pra esse papel: preserva o que já estava salvo.
    if (typeof recebida !== 'string' || recebida === '') {
      if (typeof guardada === 'string' && guardada !== '') resultado[papel] = guardada;
      continue;
    }

    // Já é hash (o cliente devolveu algo que veio de um estado antigo) — não re-hasheia.
    if (ehHashBcrypt(recebida)) {
      resultado[papel] = recebida;
      continue;
    }

    resultado[papel] = await bcrypt.hash(recebida, SALT_ROUNDS);
  }

  novo.rolePasswords = resultado;
  delete novo._acessoRestrito;
  return JSON.stringify(novo);
}

/**
 * Formato mínimo aceitável do estado da ferramenta de Folgas — não valida o
 * conteúdo de cada item (isso continua sendo responsabilidade do cliente),
 * só garante que os campos conhecidos, quando presentes, são do tipo certo
 * (array/objeto). Isso é o suficiente pra barrar o caso real que
 * importa: um bug no cliente (ou uma gravação truncada) mandando algo como
 * `employees: "oops"` — um JSON tecnicamente válido, mas que quebraria a
 * ferramenta pra QUALQUER pessoa que carregasse esse estado depois, exigindo
 * mexer direto no banco pra corrigir. `.passthrough()` deixa passar campos
 * desconhecidos, pra uma versão futura da ferramenta poder adicionar campos
 * sem precisar de uma atualização correspondente aqui.
 */
const estadoFolgasSchema = z
  .object({
    employees: z.array(z.any()).optional(),
    credits: z.array(z.any()).optional(),
    daysOff: z.array(z.any()).optional(),
    leaves: z.array(z.any()).optional(),
    creditSwaps: z.array(z.any()).optional(),
    blockedDates: z.array(z.any()).optional(),
    blockedWeekdays: z.array(z.any()).optional(),
    auditLog: z.array(z.any()).optional(),
    rolePasswords: z.record(z.string()).optional(),
  })
  .passthrough();

/** Devolve uma mensagem de erro se `valorJson` não tiver o formato mínimo esperado, ou `null` se estiver ok. */
export function validarFormatoEstado(valorJson: string): string | null {
  let estado: unknown;
  try {
    estado = JSON.parse(valorJson);
  } catch {
    return 'O valor não é um JSON válido.'; // defesa extra — já barrado antes pelo DTO genérico
  }

  const resultado = estadoFolgasSchema.safeParse(estado);
  if (resultado.success) return null;

  const primeiroProblema = resultado.error.issues[0];
  const campo = primeiroProblema.path.join('.') || '(raiz)';
  return `Formato inválido no campo "${campo}": ${primeiroProblema.message}`;
}
