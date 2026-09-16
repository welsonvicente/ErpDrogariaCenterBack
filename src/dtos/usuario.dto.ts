import { z } from 'zod';
import { PIN_MAX_DIGITOS, PIN_MIN_DIGITOS_GESTOR } from '../constants/credenciais';
import { PerfilUsuario } from '../models/Usuario';

/** Cadastro de funcionário pelo gerente: nome + código + PIN de acesso. */
export const criarFuncionarioSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres.'),
  codigo: z.string().trim().min(1, 'Código é obrigatório.').max(12),
  pin: z.string().trim().regex(/^\d+$/, 'PIN deve conter apenas números.').min(4, 'PIN deve ter ao menos 4 dígitos.').max(8),
  icone: z.string().trim().min(1).max(8).default('🙂'),
});
export type CriarFuncionarioDTO = z.infer<typeof criarFuncionarioSchema>;

export const atualizarFuncionarioSchema = z
  .object({
    nome: z.string().trim().min(2).optional(),
    codigo: z.string().trim().min(1).max(12).optional(),
    pin: z.string().trim().regex(/^\d+$/, 'PIN deve conter apenas números.').min(4).max(8).optional(),
    icone: z.string().trim().min(1).max(8).optional(),
    ativo: z.boolean().optional(),
    /**
     * Promove/rebaixa. Só o ADMIN pode mandar este campo — a checagem é no
     * service, que conhece quem está autenticado (ver UsuarioService.update).
     */
    perfil: z.nativeEnum(PerfilUsuario).optional(),
  })
  .superRefine((data, ctx) => {
    // Quem promove NÃO escolhe o PIN de quem é promovido: quem define é a própria
    // pessoa, no primeiro acesso ao painel (ver definirPinGestorSchema abaixo).
    // Um PIN escolhido por outro já nasce sendo um segredo compartilhado — e um
    // PIN padrão seria pior ainda, uma credencial de fábrica conhecida.
    const viraGestao = data.perfil === PerfilUsuario.ADMIN || data.perfil === PerfilUsuario.GERENTE;
    if (viraGestao && data.pin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pin'],
        message: 'Ao promover, não defina o PIN: a própria pessoa escolhe o dela no primeiro acesso ao painel.',
      });
    }
  });
export type AtualizarFuncionarioDTO = z.infer<typeof atualizarFuncionarioSchema>;

/**
 * Troca de PIN feita pelo próprio funcionário pra liberar o Painel do Gerente.
 * Exige o PIN atual — é o que prova que é mesmo a pessoa, e não alguém que
 * pegou o terminal destravado no balcão.
 */
export const definirPinGestorSchema = z.object({
  pinAtual: z.string().trim().min(1, 'PIN atual é obrigatório.'),
  novoPin: z
    .string()
    .trim()
    .regex(/^\d+$/, 'PIN deve conter apenas números.')
    .min(PIN_MIN_DIGITOS_GESTOR, `O PIN precisa ter ao menos ${PIN_MIN_DIGITOS_GESTOR} dígitos.`)
    .max(PIN_MAX_DIGITOS),
});
export type DefinirPinGestorDTO = z.infer<typeof definirPinGestorSchema>;
