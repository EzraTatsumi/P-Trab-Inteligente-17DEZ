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
  ShadingType,
  ImageRun
} from "docx";
import { saveAs } from "file-saver";
import { formatNumber, formatCodug } from "./formatUtils";
import { LOGO_MD_BASE64 } from "@/lib/assetsBase64";

const standardBorder = { style: BorderStyle.SINGLE, size: 1, color: "000000" };

const createCell = (text: string, options: any = {}) => {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ 
        text: text || "", 
        bold: options.bold || false, 
        size: options.size || 22, 
        color: options.color || "000000",
        allCaps: options.upper || false
      })],
      alignment: options.align || AlignmentType.LEFT,
      spacing: { before: 60, after: 60 }
    })],
    shading: options.bg ? { fill: options.bg, type: ShadingType.CLEAR, color: "auto" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    borders: { top: standardBorder, bottom: standardBorder, left: standardBorder, right: standardBorder },
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    columnSpan: options.colSpan || 1,
  });
};

const createMultiLineParagraphs = (text: string, size: number = 22) => {
  if (!text) return [new Paragraph({ text: "" })];
  return text.split('\n').map(line => new Paragraph({
    children: [new TextRun({ text: line, size })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 40, after: 40 }
  }));
};

export async function exportDORToWord(ptrabData: any, dorData: any) {
  const anoAtual = new Date().getFullYear();
  const dataAtual = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const dataDocumento = new Date(dorData.created_at).toLocaleDateString('pt-BR');

  let logoElement: any;
  try {
    // Converte o Base64 que criamos para ArrayBuffer
    const base64Data = LOGO_MD_BASE64.split(",")[1];
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    logoElement = new ImageRun({
      data: bytes.buffer,
      transformation: { width: 60, height: 60 },
      type: "png"
    });
  } catch (e) {
    logoElement = new TextRun({ text: "MD", bold: true });
  }

  const mainHeaderTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [logoElement], alignment: AlignmentType.CENTER })],
            verticalAlign: VerticalAlign.CENTER,
            borders: { top: standardBorder, bottom: standardBorder, left: standardBorder, right: standardBorder }
          }),
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

  // ... (Restante das tabelas: orgaoTable, itemsTable, etc - mantenha a lógica que você já tinha)
  
  // Quadro de Assinatura e Finalização
  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
      children: [
        mainHeaderTable,
        new Paragraph({ text: "", spacing: { before: 150 } }),
        // ... adicione as outras tabelas aqui (orgaoTable, etc)
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `DOR_${dorData.numero_dor || 'SN'}_${ptrabData.nome_om}.docx`);
}