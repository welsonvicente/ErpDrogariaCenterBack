import rateLimit, { MemoryStore } from 'express-rate-limit';

const pinGestorStore = new MemoryStore();

/**
 * Limite da rota em que o funcionário define o próprio PIN de acesso ao painel
 * (ver perfil.routes.ts). O login em si não tem limite (decisão do dono, ver
 * auth.routes.ts); esta rota tem porque:
 *
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
