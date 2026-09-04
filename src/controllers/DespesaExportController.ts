import { Response } from 'express';
import { listarDespesasQuerySchema } from '../dtos/despesa.dto';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { CategoriaRepository } from '../repositories/CategoriaRepository';
import { DespesaExportService } from '../services/DespesaExportService';
import { DespesaService } from '../services/DespesaService';

/**
 * Monta o título do relatório de acordo com o filtro de categoria: se uma
 * categoria específica foi escolhida no dashboard, o relatório sai só dela;
 * senão, sai "todas as categorias" — sem precisar de uma rota separada para
 * cada caso, o filtro que já existe no dashboard já resolve isso.
 */
async function montarTitulo(organizacaoId: string, categoriaId?: string) {
  if (!categoriaId) return 'Relatório de despesas — todas as categorias';
  const categoria = await CategoriaRepository.findById(organizacaoId, categoriaId);
  return `Relatório de despesas — ${categoria?.nome ?? 'categoria'}`;
}

export class DespesaExportController {
  static async excel(req: AuthenticatedRequest, res: Response) {
    const query = listarDespesasQuerySchema.partial().parse(req.query);
    const organizacaoId = req.usuario!.organizacaoId;

    const [despesas, titulo] = await Promise.all([
      DespesaService.listParaExportacao(organizacaoId, query),
      montarTitulo(organizacaoId, query.categoriaId),
    ]);

    const buffer = await DespesaExportService.gerarExcel(despesas, titulo);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="despesas.xlsx"');
    res.send(buffer);
  }

  static async pdf(req: AuthenticatedRequest, res: Response) {
    const query = listarDespesasQuerySchema.partial().parse(req.query);
    const organizacaoId = req.usuario!.organizacaoId;

    const [despesas, titulo] = await Promise.all([
      DespesaService.listParaExportacao(organizacaoId, query),
      montarTitulo(organizacaoId, query.categoriaId),
    ]);

    const buffer = await DespesaExportService.gerarPdf(despesas, titulo);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="despesas.pdf"');
    res.send(buffer);
  }
}
