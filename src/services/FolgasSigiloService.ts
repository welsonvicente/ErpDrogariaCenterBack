import jwt from 'jsonwebtoken';
import { env } from '../config/env';

/**
 * A ferramenta de Folgas (public/tools/folgas-drogaria-center.html) guarda
 * TODO o estado da organização numa única chave do armazenamento genérico
 * (ver ArmazenamentoAppService) — incluindo dado sensível: as senhas de
 * papel (Supervisor/Gerência/CEO) em texto puro e o motivo de cada
 * atestado médico. A rota de armazenamento só exige "estar logado" (não
 * distingue perfil — ver armazenamentoApp.routes.ts), então sem isso
 * qualquer funcionário autenticado no PharmaMind conseguiria ler esses
 * dados direto pela API, sem nunca passar pela tela nem saber senha
 * nenhuma da ferramenta.
 *
 * Este módulo intercepta especificamente essa chave pra:
 *  1. Esconder os campos sensíveis de quem não "elevou" o acesso dentro
 *     da ferramenta (ver `redigirEstado`);
 *  2. Proteger gravações de quem não elevou, pra não sobrescrever esses
 *     campos com a versão incompleta que ela só enxergou (ver
 *     `protegerGravacao`).
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
const NOTA_OCULTA = '(detalhes visíveis só para quem tem acesso de gestor)';

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

/**
 * Verifica uma credencial contra o estado já salvo (nunca contra o que o
 * cliente diz que é verdade) — usada pelo endpoint de elevação. Devolve o
 * nome do papel concedido quando válida (o cliente não tem mais como saber
 * isso sozinho, já que rolePasswords fica oculto), ou `null` se inválida.
 */
export function verificarCredencial(
  valorJson: string | null,
  credencial: { tipo: 'papel'; senha: string } | { tipo: 'funcionario'; funcionarioId: string; codigo: string },
): string | null {
  if (!valorJson) return null;
  let estado: any;
  try {
    estado = JSON.parse(valorJson);
  } catch {
    return null;
  }

  if (credencial.tipo === 'papel') {
    const papeis = estado.rolePasswords || {};
    const papel = Object.keys(papeis).find((p) => papeis[p] === credencial.senha);
    return papel ?? null;
  }

  const funcionario = (estado.employees || []).find((e: any) => e.id === credencial.funcionarioId);
  if (!funcionario || !funcionario.role || funcionario.code !== credencial.codigo) return null;
  return funcionario.role;
}

/** Remove/oculta os campos sensíveis antes de devolver o estado pra quem não elevou o acesso. */
export function redigirEstado(valorJson: string): string {
  let estado: any;
  try {
    estado = JSON.parse(valorJson);
  } catch {
    return valorJson; // não é JSON reconhecível — devolve como está, nada a redigir
  }

  const { rolePasswords, ...resto } = estado;
  const leaves = Array.isArray(estado.leaves)
    ? estado.leaves.map((l: any) => (l?.type === 'atestado' && l?.note ? { ...l, note: NOTA_OCULTA } : l))
    : estado.leaves;

  // `_acessoRestrito: true` avisa o cliente que rolePasswords não está
  // simplesmente "ainda não configurado" (caso em que ele preencheria com
  // as senhas padrão) — está oculto de propósito.
  return JSON.stringify({ ...resto, leaves, _acessoRestrito: true });
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
  let novo: any;
  try {
    novo = JSON.parse(valorNovoJson);
  } catch {
    return valorNovoJson; // não é JSON reconhecível — o armazenamento genérico não valida schema, deixa passar
  }

  let anterior: any = {};
  if (valorAnteriorJson) {
    try {
      anterior = JSON.parse(valorAnteriorJson) ?? {};
    } catch {
      anterior = {};
    }
  }

  novo.rolePasswords = anterior.rolePasswords ?? novo.rolePasswords ?? {};
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
