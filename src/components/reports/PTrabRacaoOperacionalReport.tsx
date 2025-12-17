import React, { useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatNumber, formatDateDDMMMAA } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PTrabData,
  ClasseIRegistro,
  calculateDays,
  formatDate,
  formatFasesParaTexto,
} from "@/pages/PTrabReportManager"; // Importar tipos e funções auxiliares do Manager

interface PTrabRacaoOperacionalReportProps {
  ptrabData: PTrabData;
  registrosClasseI: ClasseIRegistro[];
  onExportSuccess: () => void;
}

// Interface para a linha consolidada de Ração Operacional
interface RacaoOpLinha {
    om: string;
    ug: string;
    r2_quantidade: number;
    r3_quantidade: number;
    total_unidades: number;
    fase_atividade: string;
    efetivo: number;
    dias_operacao: number;
}

// Função para gerar a memória de cálculo detalhada para Ração Operacional
const generateRacaoOpMemoriaCalculo = (linha: RacaoOpLinha): string => {
    const { om, ug, r2_quantidade, r3_quantidade, efetivo, dias_operacao, fase_atividade } = linha;
    const totalRacoes = r2_quantidade + r3_quantidade;
    const faseFormatada = formatFasesParaTexto(fase_atividade);

    // O detalhamento deve ser genérico, pois o usuário não insere a memória customizada aqui.
    // Usamos o formato do exemplo: 33.90.30 – ração operacional para atender [efetivo] militares, por até [dias] dias...
    
    // Nota: O modelo fornecido usa 12 dias como exemplo, mas o cálculo real deve usar os dias de operação do registro.
    // Para manter a fidelidade ao formato, vamos usar os dados do registro.
    
    return `33.90.30 – ração operacional para atender ${efetivo} militares, por até ${dias_operacao} dias, para ser utilizada na Operação de ${faseFormatada}, em caso de comprometimento do fluxo Cl I (QR/QS) ou de tarefas, descentralizadas, afastadas da(s) base(s) de apoio logístico.
OM de Destino: ${om} (UG: ${ug})

Quantitativo R2 (24h): ${formatNumber(r2_quantidade)} un.
Quantitativo R3 (12h): ${formatNumber(r3_quantidade)} un.

Total de Rções Operacionais: ${formatNumber(totalRacoes)} unidades.`;
};


const PTrabRacaoOperacionalReport: React.FC<PTrabRacaoOperacionalReportProps> = ({
  ptrabData,
  registrosClasseI,
  onExportSuccess,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
  
  const racaoOperacionalConsolidada = useMemo(() => {
    const registros = registrosClasseI.filter(r => r.categoria === 'RACAO_OPERACIONAL' && ((r.quantidade_r2 || 0) > 0 || (r.quantidade_r3 || 0) > 0));
    
    // Agrupar por OM de destino (organizacao/ug)
    const grupos: Record<string, RacaoOpLinha> = {};
    
    registros.forEach(r => {
        const key = `${r.organizacao}-${r.ug}`;
        
        if (!grupos[key]) {
            grupos[key] = {
                om: r.organizacao,
                ug: r.ug,
                r2_quantidade: 0,
                r3_quantidade: 0,
                total_unidades: 0,
                fase_atividade: r.fase_atividade || 'operação',
                efetivo: r.efetivo || 0,
                dias_operacao: r.dias_operacao,
            };
        }
        
        // Consolida as quantidades (embora o formulário atual só permita um registro por OM/Categoria,
        // esta lógica garante que se houver mais de um, eles sejam somados)
        grupos[key].r2_quantidade += (r.quantidade_r2 || 0);
        grupos[key].r3_quantidade += (r.quantidade_r3 || 0);
        grupos[key].total_unidades += (r.quantidade_r2 || 0) + (r.quantidade_r3 || 0);
        
        // Nota: Mantemos os dados de efetivo/dias/fase do último registro, assumindo que são consistentes por OM.
    });
    
    return Object.values(grupos).sort((a, b) => a.om.localeCompare(b.om));
  }, [registrosClasseI]);
  
  const totalRacoesGeral = racaoOperacionalConsolidada.reduce((sum, r) => sum + r.total_unidades, 0);
  
  // NOVO: Função para gerar o nome do arquivo
  const generateFileName = (reportType: 'PDF' | 'Excel') => {
    const dataAtz = formatDateDDMMMAA(ptrabData.updated_at);
    const numeroPTrab = ptrabData.numero_ptrab.replace(/\//g, '-'); 
    
    // 1. Usar a sigla da OM diretamente (sem forçar caixa alta)
    const omSigla = ptrabData.nome_om;
    
    // 2. Construir o nome base com a OM em posição padronizada:
    // P Trab Nr [NUMERO] - [OM_SIGLA] - [NOME_OPERACAO]
    let nomeBase = `P Trab Nr ${numeroPTrab} - ${omSigla} - ${ptrabData.nome_operacao}`;
    
    // 3. Adicionar a data de atualização
    nomeBase += ` - Atz ${dataAtz}`;
    
    return `${nomeBase}.${reportType === 'PDF' ? 'pdf' : 'xlsx'}`;
  };

  const handlePrint = () => {
// ... (restante do arquivo)