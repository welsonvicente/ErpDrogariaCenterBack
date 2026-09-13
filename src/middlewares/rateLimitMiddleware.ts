import rateLimit from 'express-rate-limit';

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
  message: { message: 'Muitas tentativas seguidas. Aguarde alguns minutos antes de tentar de novo.' },
});
