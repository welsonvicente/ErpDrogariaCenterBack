/**
 * Requisitos de credencial do login rápido (código + PIN) do funcionário.
 *
 * O login de funcionário é deliberadamente curto porque acontece no balcão, em
 * terminal compartilhado, dezenas de vezes por dia — o que ele protege é "lançar
 * um gasto em meu nome". Quem recebe `podeAcessarGestor` passa a proteger outra
 * coisa com a MESMA credencial: todas as despesas, a gestão de funcionários, a
 * auditoria e a exportação. Por isso o piso sobe pra essas pessoas.
 *
 * Não é um piso alto — é o mínimo pra que uma tentativa cega deixe de ser
 * trivial. O que de fato segura força bruta é o bloqueio por conta
 * (ver utils/tentativasLogin.ts), já que o rate limit por IP sozinho não
 * distingue o balcão inteiro atrás de um NAT de um atacante rotacionando IPs.
 */
export const PIN_MIN_DIGITOS = 4;
export const PIN_MAX_DIGITOS = 8;

/** Piso pra quem tem acesso ao painel do gerente. */
export const PIN_MIN_DIGITOS_GESTOR = 6;
export const CODIGO_MIN_CARACTERES_GESTOR = 3;
