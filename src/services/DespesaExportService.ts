import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { FormaPagamento } from '../models/Despesa';

/** Formato mínimo necessário pro relatório — não exige o Despesa/Usuario completos (evita vazar hashes por engano). */
export interface DespesaParaRelatorio {
  data: string;
  valor: string;
  formaPagamento: FormaPagamento;
  descricao: string | null;
  usuario: { nome: string };
  categoria: { nome: string };
}

const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  [FormaPagamento.DINHEIRO]: 'Dinheiro',
  [FormaPagamento.CARTAO_DEBITO]: 'Cartão de Débito',
  [FormaPagamento.CARTAO_CREDITO]: 'Cartão de Crédito',
  [FormaPagamento.PIX]: 'PIX',
  [FormaPagamento.BOLETO]: 'Boleto',
  [FormaPagamento.OUTRO]: 'Outro',
};

function fmtData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function fmtMoeda(valor: string): string {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Geração dos arquivos de exportação do dashboard do gestor (Excel/PDF).
 * Mora numa camada própria (não em DespesaService) porque é uma
 * responsabilidade diferente de "regra de negócio de despesa": é só
 * apresentação/formatação de um relatório sobre dados já validados.
 */
export class DespesaExportService {
  static async gerarExcel(despesas: DespesaParaRelatorio[], tituloRelatorio: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Drogaria Center ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Despesas');

    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = tituloRelatorio;
    sheet.getCell('A1').font = { bold: true, size: 14 };

    sheet.addRow([]);

    const headerRow = sheet.addRow(['Data', 'Funcionário', 'Categoria', 'Forma de pagamento', 'Descrição', 'Valor']);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF7CC' } };
    });

    let total = 0;
    for (const despesa of despesas) {
      sheet.addRow([
        fmtData(despesa.data),
        despesa.usuario.nome,
        despesa.categoria.nome,
        FORMA_PAGAMENTO_LABEL[despesa.formaPagamento],
        despesa.descricao ?? '',
        Number(despesa.valor),
      ]);
      total += Number(despesa.valor);
    }

    sheet.addRow([]);
    const totalRow = sheet.addRow(['', '', '', '', 'Total', total]);
    totalRow.font = { bold: true };

    sheet.getColumn(1).width = 12;
    sheet.getColumn(2).width = 24;
    sheet.getColumn(3).width = 28;
    sheet.getColumn(4).width = 20;
    sheet.getColumn(5).width = 36;
    sheet.getColumn(6).width = 16;
    sheet.getColumn(6).numFmt = '"R$" #,##0.00';

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  static gerarPdf(despesas: DespesaParaRelatorio[], tituloRelatorio: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const colunas = [
        { titulo: 'Data', largura: 70 },
        { titulo: 'Funcionário', largura: 130 },
        { titulo: 'Categoria', largura: 150 },
        { titulo: 'Forma de pagamento', largura: 120 },
        { titulo: 'Descrição', largura: 220 },
        { titulo: 'Valor', largura: 90 },
      ];
      const xInicial = doc.page.margins.left;
      const larguraTotal = colunas.reduce((soma, col) => soma + col.largura, 0);

      function desenharCabecalho() {
        doc.fontSize(14).font('Helvetica-Bold').text(tituloRelatorio, xInicial, doc.y);
        doc.moveDown(1);

        const y = doc.y;
        doc.fontSize(9).font('Helvetica-Bold');
        let x = xInicial;
        colunas.forEach((col) => {
          doc.text(col.titulo, x, y, { width: col.largura });
          x += col.largura;
        });
        doc.moveDown(0.6);
        doc.moveTo(xInicial, doc.y).lineTo(xInicial + larguraTotal, doc.y).strokeColor('#628B00').stroke();
        doc.moveDown(0.3);
        doc.font('Helvetica');
      }

      desenharCabecalho();

      let total = 0;
      for (const despesa of despesas) {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
          doc.addPage();
          desenharCabecalho();
        }

        const y = doc.y;
        let x = xInicial;
        const valores = [
          fmtData(despesa.data),
          despesa.usuario.nome,
          despesa.categoria.nome,
          FORMA_PAGAMENTO_LABEL[despesa.formaPagamento],
          despesa.descricao ?? '—',
          fmtMoeda(despesa.valor),
        ];

        doc.fontSize(9);
        valores.forEach((valor, index) => {
          doc.text(valor, x, y, { width: colunas[index].largura });
          x += colunas[index].largura;
        });
        doc.moveDown(0.5);
        total += Number(despesa.valor);
      }

      doc.moveDown(0.5);
      doc.moveTo(xInicial, doc.y).lineTo(xInicial + larguraTotal, doc.y).strokeColor('#628B00').stroke();
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text(`Total: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, xInicial, doc.y);

      doc.end();
    });
  }
}
