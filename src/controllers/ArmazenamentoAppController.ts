import { Response } from 'express';
import { AuthenticatedRequest, verificarPoderDeGerente } from '../middlewares/authMiddleware';
import { chaveArmazenamentoSchema, salvarArmazenamentoSchema } from '../dtos/armazenamentoApp.dto';
import { ArmazenamentoAppService } from '../services/ArmazenamentoAppService';
import { CHAVE_FOLGAS, protegerGravacao, redigirEstado, validarFormatoEstado } from '../services/FolgasSigiloService';
import { AppError } from '../utils/AppError';

/**
 * Aplica a ocultação de dado sensível (ver FolgasSigiloService) quando cabível,
 * antes de expor um valor pela API — quem é gerente vê tudo, quem não é vê a
 * versão com o motivo do atestado oculto.
 */
async function talvezRedigir(valor: string, chave: string, req: AuthenticatedRequest): Promise<string> {
  if (chave !== CHAVE_FOLGAS) return valor;
  const resultado = await verificarPoderDeGerente(req.usuario!);
  return resultado.podeGerenciar ? valor : redigirEstado(valor);
}

export class ArmazenamentoAppController {
  static async get(req: AuthenticatedRequest, res: Response) {
    const chave = chaveArmazenamentoSchema.parse(req.params.chave);
    const registro = await ArmazenamentoAppService.get(req.usuario!.organizacaoId, chave);
    if (!registro) {
      res.status(200).json({ valor: null, versao: 0 });
      return;
    }

    const valor = await talvezRedigir(registro.valor, chave, req);
    res.status(200).json({ valor, versao: registro.versao });
  }

  /**
   * `versaoEsperada` (opcional) ativa concorrência otimista — ver
   * ArmazenamentoAppService.setComVersao. Em conflito, devolve 409 com o
   * valor/versão atuais pra quem chamou recarregar em vez de tentar nas
   * cegas de novo (e perder a mudança de quem salvou primeiro).
   */
  static async set(req: AuthenticatedRequest, res: Response) {
    const chave = chaveArmazenamentoSchema.parse(req.params.chave);
    const { valor, versaoEsperada } = salvarArmazenamentoSchema.parse(req.body);
    const organizacaoId = req.usuario!.organizacaoId;

    let valorFinal = valor;
    if (chave === CHAVE_FOLGAS) {
      const registroAtual = await ArmazenamentoAppService.get(organizacaoId, chave);
      const valorAnterior = registroAtual?.valor ?? null;

      const resultado = await verificarPoderDeGerente(req.usuario!);
      valorFinal = resultado.podeGerenciar ? valor : protegerGravacao(valorAnterior, valor);

      // Barra aqui um formato claramente quebrado (ex.: `employees` virando
      // uma string por bug no cliente) — sem isso, um valor assim ficaria
      // salvo e quebraria a ferramenta pra QUALQUER pessoa na próxima
      // leitura, só corrigível mexendo direto no banco.
      const erroFormato = validarFormatoEstado(valorFinal);
      if (erroFormato) {
        throw new AppError(erroFormato, 400);
      }
    }

    if (versaoEsperada === undefined) {
      const versao = await ArmazenamentoAppService.set(organizacaoId, chave, valorFinal);
      res.status(200).json({ versao });
      return;
    }

    const resultado = await ArmazenamentoAppService.setComVersao(organizacaoId, chave, valorFinal, versaoEsperada);
    if (resultado.conflito) {
      const atual = resultado.registro;
      res.status(409).json({
        message: 'Alguém mais salvou uma alteração aqui enquanto você editava.',
        valor: atual ? await talvezRedigir(atual.valor, chave, req) : null,
        versao: atual?.versao ?? 0,
      });
      return;
    }

    res.status(200).json({ versao: resultado.registro!.versao });
  }
}
