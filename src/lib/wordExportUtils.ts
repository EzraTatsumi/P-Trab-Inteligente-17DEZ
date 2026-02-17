import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle, 
  AlignmentType, 
  VerticalAlign,
  ShadingType
} from "docx";
import { saveAs } from "file-saver";
import { formatNumber, formatCodug } from "./formatUtils";

/**
 * Gera e faz o download de um arquivo Word (.docx) para o DOR.
 */
export async function exportDORToWord(ptrabData: any, dorData: any) {
  const anoAtual = new Date().getFullYear();
  const dataAtual = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const dataDocumento = new Date(dorData.created_at).toLocaleDateString('pt-BR');

  // Configurações de borda padrão
  const standardBorder = { style: BorderStyle.SINGLE, size: 1, color: "000000" };

  // Função auxiliar para criar células de tabela com formatação precisa
  const createCell = (text: string, options: any = {}) => {
    return new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ 
          text: text || "", 
          bold: options.bold || false, 
          size: options.size || 22, // 11pt
          color: options.color || "000000",
          allCaps: options.upper || false
        })],
        alignment: options.align || AlignmentType.LEFT,
        spacing: { before: 60, after: 60 }
      })],
      shading: options.bg ? { fill: options.bg, type: ShadingType.CLEAR, color: "auto" } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      borders: {
        top: standardBorder,
        bottom: standardBorder,
        left: standardBorder,
        right: standardBorder,
      },
      width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
      columnSpan: options.colSpan || 1,
    });
  };

  // 1. Cabeçalho Principal (Logo + Texto + Número)
  const mainHeaderTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          // Coluna 1: Logo (EB)
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ 
              children: [new TextRun({ text: "EB", bold: true, size: 24 })],
              alignment: AlignmentType.CENTER,
            })],
            verticalAlign: VerticalAlign.CENTER,
            borders: { top: standardBorder, bottom: standardBorder, left: standardBorder, right: standardBorder }
          }),
          // Coluna 2: Texto Central
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "MINISTÉRIO DA DEFESA", bold: true, size: 22 }),
                  new TextRun({ text: "EXÉRCITO BRASILEIRO", bold: true, size: 22, break: 1 }),
                  new TextRun({ text: ptrabData.comando_militar_area, bold: true, size: 22, break: 1 }),
                  new TextRun({ text: ptrabData.nome_om_extenso || ptrabData.nome_om, bold: true, size: 22, break: 1 }),
                ],
                alignment: AlignmentType.CENTER,
              })
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: { top: standardBorder, bottom: standardBorder, left: standardBorder, right: standardBorder }
          }),
          // Coluna 3: Número do DOR
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Documento de Oficialização da Requisição – DOR", bold: true, size: 20 }),
                  new TextRun({ text: `nº ${dorData.numero_dor || '___'} / ${anoAtual}`, bold: true, size: 22, break: 1 }),
                  new TextRun({ text: dataDocumento, size: 22, break: 1 }),
                ],
                alignment: AlignmentType.CENTER,
              })
            ],
            verticalAlign: VerticalAlign.CENTER,
            borders: { top: standardBorder, bottom: standardBorder, left: standardBorder, right: standardBorder }
          }),
        ],
      }),
    ],
  });

  // 2. Dados do Órgão Requisitante
  const orgaoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [createCell("DADOS DO ÓRGÃO REQUISITANTE", { bold: true, align: AlignmentType.CENTER, bg: "000000", color: "FFFFFF", colSpan: 2 })] }),
      new TableRow({ children: [createCell("Órgão:", { bold: true, colSpan: 2 })] }),
      new TableRow({ children: [createCell(ptrabData.nome_om_extenso || ptrabData.nome_om, { colSpan: 2 })] }),
      new TableRow({ children: [createCell("Responsável pela Demanda:", { bold: true, colSpan: 2 })] }),
      new TableRow({ children: [createCell(ptrabData.nome_cmt_om || "Não informado", { colSpan: 2 })] }),
      new TableRow({
        children: [
          createCell(`E-mail: ${dorData.email || ""}`, { width: 50 }),
          createCell(`Telefone: ${dorData.telefone || ""}`, { width: 50 }),
        ]
      }),
    ],
  });

  // 3. Itens de Custo
  const itemsRows = [
    new TableRow({ children: [createCell("OBJETO DE REQUISIÇÃO", { bold: true, align: AlignmentType.CENTER, bg: "000000", color: "FFFFFF", colSpan: 4 })] }),
    new TableRow({ children: [createCell(`Evento: ${dorData.evento || ""}`, { colSpan: 4 })] }),
    new TableRow({ children: [createCell("DESCRIÇÃO DO ITEM", { bold: true, align: AlignmentType.CENTER, bg: "000000", color: "FFFFFF", colSpan: 4 })] }),
    new TableRow({
      children: [
        createCell("UGE", { bold: true, align: AlignmentType.CENTER, width: 25 }),
        createCell("GND", { bold: true, align: AlignmentType.CENTER, width: 10 }),
        createCell("VALOR", { bold: true, align: AlignmentType.CENTER, width: 20 }),
        createCell("DESCRIÇÃO", { bold: true, align: AlignmentType.CENTER, width: 45 }),
      ]
    })
  ];

  dorData.itens_dor?.forEach((item: any) => {
    itemsRows.push(new TableRow({
      children: [
        createCell(`${item.uge_name || item.uge || "N/I"}${item.uge_code ? ` (${formatCodug(item.uge_code)})` : ""}`, { align: AlignmentType.CENTER }),
        createCell(String(item.gnd), { align: AlignmentType.CENTER }),
        createCell(formatNumber(item.valor_num), { align: AlignmentType.CENTER }),
        createCell(item.descricao || "", { align: AlignmentType.CENTER, upper: true }),
      ]
    }));
  });

  const itemsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: itemsRows,
  });

  // 4. Seções de Texto
  const createSectionTable = (title: string, content: string) => {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [createCell(title, { bold: true, align: AlignmentType.CENTER, bg: "000000", color: "FFFFFF" })] }),
        new TableRow({ children: [new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: content || "", size: 22 })],
            alignment: AlignmentType.JUSTIFY,
            spacing: { before: 100, after: 100 }
          })],
          borders: { top: standardBorder, bottom: standardBorder, left: standardBorder, right: standardBorder }
        })] }),
      ],
    });
  };

  // Montagem do Documento
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, // ~2cm
          },
        },
        children: [
          mainHeaderTable,
          new Paragraph({ text: "", spacing: { before: 150 } }),
          orgaoTable,
          new Paragraph({ text: "", spacing: { before: 150 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [createCell("ANEXOS", { bold: true, align: AlignmentType.CENTER, bg: "000000", color: "FFFFFF" })] }),
              new TableRow({ children: [createCell(dorData.anexos || "----", { align: AlignmentType.CENTER })] }),
            ]
          }),
          new Paragraph({ text: "", spacing: { before: 150 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [createCell(`Ação Orçamentária (AO): ${dorData.acao_orcamentaria || ""}`, { bold: true, bg: "000000", color: "FFFFFF" })] }),
              new TableRow({ children: [createCell(`Plano Orçamentário (PO): ${dorData.plano_orcamentario || ""}`, { bold: true })] }),
            ]
          }),
          new Paragraph({ text: "", spacing: { before: 150 } }),
          itemsTable,
          new Paragraph({ text: "", spacing: { before: 150 } }),
          createSectionTable("FINALIDADE", dorData.finalidade),
          new Paragraph({ text: "", spacing: { before: 150 } }),
          createSectionTable("MOTIVAÇÃO", dorData.motivacao),
          new Paragraph({ text: "", spacing: { before: 150 } }),
          createSectionTable("CONSEQUÊNCIA DO NÃO ATENDIMENTO", dorData.consequencia),
          new Paragraph({ text: "", spacing: { before: 150 } }),
          createSectionTable("OBSERVAÇÕES GERAIS", dorData.observacoes),
          new Paragraph({ text: "", spacing: { before: 400 } }),
          
          // Bloco de Assinatura
          new Paragraph({
            children: [new TextRun({ text: `${ptrabData.local_om || "Local não informado"}, ${dataAtual}.`, size: 22 })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "", spacing: { before: 400 } }),
          new Paragraph({
            children: [new TextRun({ text: ptrabData.nome_cmt_om || "NOME DO ORDENADOR DE DESPESAS", bold: true, size: 22, allCaps: true })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [new TextRun({ text: `Comandante da ${ptrabData.nome_om_extenso || ptrabData.nome_om}`, size: 22 })],
            alignment: AlignmentType.CENTER,
          }),
        ],
      },
    ],
  });

  // Gerar e salvar o arquivo
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `DOR_${dorData.numero_dor || 'SN'}_${ptrabData.nome_om}.docx`);
}