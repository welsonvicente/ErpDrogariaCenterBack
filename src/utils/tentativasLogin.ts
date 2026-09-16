import { logger } from '../config/logger';

/**
 * Bloqueio temporário por CONTA depois de tentativas erradas seguidas.
 *
 * Complementa o rate limit por IP (middlewares/rateLimitMiddleware.ts), que
 * sozinho não resolve o caso real desta aplicação: os funcionários do balcão
 * saem todos pelo mesmo IP (NAT), então um limite por IP ou é frouxo demais pra
 * conter ataque, ou trava a loja inteira quando uma pessoa erra o PIN. Contando
 * por conta, quem erra prejudica só a própria conta — e um atacante que troque
 * de IP não ganha nada, porque o contador acompanha o código, não a origem.
 *
 * Guardado em memória de propósito: é um processo só, e perder os contadores num
 * restart é aceitável (o pior caso é um atacante ganhar mais algumas tentativas
 * logo após um deploy). Se o backend passar a rodar em mais de uma instância,
 * isto precisa virar Redis/tabela — senão cada instância conta separado.
 */
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;
const JANELA_MS = 15 * 60 * 1000;

interface Registro {
  falhas: number;
  primeiraFalhaEm: number;
  bloqueadoAte: number | null;
}

const registros = new Map<string, Registro>();

function chaveDe(organizacaoId: string, identificador: string) {
  return `${organizacaoId}:${identificador.toLowerCase()}`;
}

/** Remove registros vencidos pra o Map não crescer sem limite com códigos inventados. */
function limpar(agora: number) {
  for (const [chave, reg] of registros) {
    const venceu = (reg.bloqueadoAte ?? 0) < agora && agora - reg.primeiraFalhaEm > JANELA_MS;
    if (venceu) registros.delete(chave);
  }
}

/**
 * Deve ser chamado ANTES de conferir a credencial. Devolve os segundos restantes
 * de bloqueio, ou `null` se a conta pode tentar.
 */
export function segundosDeBloqueio(organizacaoId: string, identificador: string): number | null {
  const agora = Date.now();
  if (registros.size > 500) limpar(agora);

  const reg = registros.get(chaveDe(organizacaoId, identificador));
  if (!reg?.bloqueadoAte) return null;
  if (reg.bloqueadoAte <= agora) return null;

  return Math.ceil((reg.bloqueadoAte - agora) / 1000);
}

/** Registra uma tentativa errada e bloqueia a conta se passou do limite. */
export function registrarFalha(organizacaoId: string, identificador: string) {
  const agora = Date.now();
  const chave = chaveDe(organizacaoId, identificador);
  const reg = registros.get(chave);

  // Fora da janela (ou primeira falha): recomeça a contagem.
  if (!reg || agora - reg.primeiraFalhaEm > JANELA_MS) {
    registros.set(chave, { falhas: 1, primeiraFalhaEm: agora, bloqueadoAte: null });
    return;
  }

  reg.falhas += 1;
  if (reg.falhas >= MAX_TENTATIVAS) {
    reg.bloqueadoAte = agora + BLOQUEIO_MS;
    reg.falhas = 0;
    reg.primeiraFalhaEm = agora;
    logger.warn('Conta bloqueada temporariamente por tentativas de login erradas', {
      organizacaoId,
      identificador,
      minutos: BLOQUEIO_MS / 60000,
    });
  }
}

/** Login certo zera o histórico da conta. */
export function registrarSucesso(organizacaoId: string, identificador: string) {
  registros.delete(chaveDe(organizacaoId, identificador));
}

/** Só pra testes — zera o estado entre casos. */
export function _limparTudo() {
  registros.clear();
}
