import rateLimit, { MemoryStore } from 'express-rate-limit';

/**
 * Store explícito (em vez do padrão implícito) só pra manter uma referência que
 * os testes consigam zerar — o limiter é criado uma vez no carregamento do
 * módulo, então sem isso o contador vaza de um teste pro outro dentro do mesmo
 * arquivo. Ver `_resetLoginRateLimit`.
 */
const loginStore = new MemoryStore();

/**
 * Limita tentativas nas rotas de login/credencial — sem isso, um PIN de
 * funcionário (4-8 dígitos numéricos) ou uma senha de papel da ferramenta de
 * Folgas (5 dígitos) são forçáveis por script em segundos, já que não há
 * nenhum outro fator (é só "estar na rede" + adivinhar o número).
 *
 * 10 tentativas a cada 15 minutos por IP é generoso o bastante pra alguém
 * errando de verdade algumas vezes, mas torna um ataque de força bruta
 * impraticável (dezenas de milhares de combinações levariam dias, não
 * segundos). `standardHeaders` manda os cabeçalhos `RateLimit-*` de volta
 * (útil pro cliente saber quando pode tentar de novo); `legacyHeaders`
 * desligado evita os cabeçalhos antigos `X-RateLimit-*` redundantes.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: loginStore,
  message: { message: 'Muitas tentativas seguidas. Aguarde alguns minutos antes de tentar de novo.' },
});

/** Só pra testes — zera o contador por IP entre casos. */
export async function _resetLoginRateLimit() {
  await loginStore.resetAll();
}

const pinGestorStore = new MemoryStore();

/**
 * Limite da rota em que o funcionário define o próprio PIN de acesso ao painel
 * (ver perfil.routes.ts). Separado do `loginRateLimiter` por dois motivos:
 *
 *  - orçamento próprio: no balcão todo mundo sai pelo mesmo IP, então dividir a
 *    cota com as telas de login faria uma pessoa ser barrada ao definir o PIN só
 *    porque os colegas logaram bastante naquele turno;
 *  - chave por USUÁRIO, não por IP: a rota já passou pelo `authenticate`, então
 *    sabemos de quem é a tentativa. Quem erra prejudica só a si mesmo, e o mesmo
 *    IP compartilhado deixa de ser um problema.
 *
 * O corpo carrega o PIN atual, então algum limite continua sendo necessário —
 * senão a rota viraria mais um lugar de onde forçá-lo por script.
 */
export const pinGestorRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: pinGestorStore,
  keyGenerator: (req) => (req as { usuario?: { id: string } }).usuario?.id ?? 'anonimo',
  message: { message: 'Muitas tentativas seguidas. Aguarde alguns minutos antes de tentar de novo.' },
});

/** Só pra testes. */
export async function _resetPinGestorRateLimit() {
  await pinGestorStore.resetAll();
}
