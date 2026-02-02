import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatCodug, formatNumber } from "@/lib/formatUtils";
import {
  PTrabData,
  GrupoOM,
  LinhaTabela,
  LinhaClasseII,
  LinhaClasseIII,
  LinhaConcessionaria,
  getClasseIILabel,
  getTipoCombustivelLabel,
  generateClasseIMemoriaCalculoUnificada,
  generateClasseIIMemoriaCalculo,
  generateClasseIXMemoriaCalculo,
  calculateItemTotalClasseIX,
} from "@/pages/PTrabReportManager";
import { Separator } from "@/components/ui/separator";
import { FileText, Package, Utensils, Briefcase, HardHat, Plane, ClipboardList, Zap, Droplet } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { generateConcessionariaMemoriaCalculo as generateConcessionariaMemoriaCalculoUtility } from "@/lib/concessionariaUtils"; // Importa a função de utilidade

interface PTrabLogisticoReportProps {
  ptrabData: PTrabData;
  registrosClasseI: any[];
  registrosClasseII: any[];
  registrosClasseIII: any[];
  nomeRM: string;
  omsOrdenadas: string[];
  gruposPorOM: Record<string, GrupoOM>;
  calcularTotaisPorOM: (grupo: GrupoOM, nomeOM: string) => {
    total_33_90_30: number;
    total_33_90_39: number;
    total_parte_azul: number;
    total_combustivel: number;
    total_gnd3: number;
    totalDieselLitros: number;
    totalGasolinaLitros: number;
    valorDiesel: number;
    valorGasolina: number;
  };
  fileSuffix: string;
  generateClasseIMemoriaCalculo: typeof generateClasseIMemoriaCalculoUnificada;
  generateClasseIIMemoriaCalculo: typeof generateClasseIIMemoriaCalculo;
  generateClasseVMemoriaCalculo: (registro: any) => string;
  generateClasseVIMemoriaCalculo: (registro: any) => string;
  generateClasseVIIMemoriaCalculo: (registro: any) => string;
  generateClasseVIIIMemoriaCalculo: (registro: any) => string;
}

// Função auxiliar para renderizar as linhas de despesa (Classe I, II, V, VI, VII, VIII, IX, III, Concessionária)
const renderExpenseLines = (
  omName: string,
  grupo: GrupoOM,
  generateClasseIMemoriaCalculo: PTrabLogisticoReportProps['generateClasseIMemoriaCalculo'],
  generateClasseIIMemoriaCalculo: PTrabLogisticoReportProps['generateClasseIIMemoriaCalculo'],
  generateClasseVMemoriaCalculo: PTrabLogisticoReportProps['generateClasseVMemoriaCalculo'],
  generateClasseVIMemoriaCalculo: PTrabLogisticoReportProps['generateClasseVIMemoriaCalculo'],
  generateClasseVIIMemoriaCalculo: PTrabLogisticoReportProps['generateClasseVIIMemoriaCalculo'],
  generateClasseVIIIMemoriaCalculo: PTrabLogisticoReportProps['generateClasseVIIIMemoriaCalculo'],
) => {
  const allLines: (LinhaTabela | LinhaClasseII | LinhaClasseIII | LinhaConcessionaria)[] = [
    ...grupo.linhasQS,
    ...grupo.linhasQR,
    ...grupo.linhasClasseII,
    ...grupo.linhasClasseV,
    ...grupo.linhasClasseVI,
    ...grupo.linhasClasseVII,
    ...grupo.linhasClasseVIII,
    ...grupo.linhasClasseIX,
    ...grupo.linhasClasseIII,
    ...grupo.linhasConcessionaria, // Adicionado Concessionária
  ];

  // Ordena as linhas para exibição (ex: Classe I, Classe II, Classe III, etc.)
  const orderedLines = allLines.sort((a, b) => {
    const getOrder = (line: typeof a) => {
      if ('tipo' in line) return 1; // Classe I (QS/QR)
      if ('categoria_equipamento' in line) return 3; // Classe III
      if ('valor_nd_39' in line && 'registro' in line && 'consumo_pessoa_dia' in line.registro) return 4; // Concessionária
      return 2; // Classes II, V, VI, VII, VIII, IX
    };
    return getOrder(a) - getOrder(b);
  });
  
  console.log(`[PTrabLogisticoReport] All expense lines for ${omName}:`, allLines);

  return orderedLines.map((line, index) => {
    let tipoDespesa = "";
    let detalhamento = "";
    let valorND30 = 0;
    let valorND39 = 0;
    let memoriaCalculo = "";
    let isClasseI = false;
    let isClasseIII = false;
    let isConcessionaria = false;

    if ('tipo' in line) {
      // Classe I (QS/QR)
      isClasseI = true;
      const registro = line.registro;
      tipoDespesa = `Classe I - Subsistência (${line.tipo})`;
      detalhamento = `Efetivo: ${registro.efetivo} | Dias: ${registro.diasOperacao} | Ref Int: ${registro.nrRefInt}`;
      valorND30 = line.valor_nd_30;
      valorND39 = line.valor_nd_39;
      memoriaCalculo = generateClasseIMemoriaCalculo(registro, line.tipo);
    } else if ('categoria_equipamento' in line) {
      // Classe III (Combustível/Lubrificante)
      isClasseIII = true;
      const registro = line.registro;
      const tipoSuprimento = line.tipo_suprimento;
      const categoriaEquipamento = line.categoria_equipamento;
      
      tipoDespesa = `Classe III - ${getTipoCombustivelLabel(tipoSuprimento)} (${getClasseIILabel(categoriaEquipamento)})`;
      detalhamento = `Litros: ${formatNumber(line.total_litros_linha, 2)} | Preço/L: ${formatCurrency(line.preco_litro_linha)}`;
      valorND30 = tipoSuprimento !== 'LUBRIFICANTE' ? line.valor_total_linha : 0;
      valorND39 = tipoSuprimento === 'LUBRIFICANTE' ? line.valor_total_linha : 0;
      memoriaCalculo = line.memoria_calculo;
    } else if ('registro' in line && 'consumo_pessoa_dia' in line.registro) {
      // Concessionária (ND 33.90.39)
      isConcessionaria = true;
      const registro = line.registro;
      tipoDespesa = `Concessionária - ${registro.categoria}`;
      detalhamento = `Efetivo: ${registro.efetivo} | Dias: ${registro.dias_operacao} | Consumo: ${formatNumber(registro.consumo_pessoa_dia, 2)} ${registro.unidade_custo}/dia`;
      valorND30 = 0;
      valorND39 = line.valor_nd_39;
      memoriaCalculo = generateConcessionariaMemoriaCalculoUtility(registro); // CORRIGIDO: Usando o nome importado
    } else {
      // Classes II, V, VI, VII, VIII, IX
      const registro = (line as LinhaClasseII).registro;
      const isClasseIX = registro.categoria && ['Vtr Administrativa', 'Vtr Operacional', 'Motocicleta', 'Vtr Blindada'].includes(registro.categoria);
      
      let classeLabel = "";
      if (registro.categoria === 'Equipamento Individual' || registro.categoria === 'Proteção Balística' || registro.categoria === 'Material de Estacionamento') {
        classeLabel = "Classe II";
      } else if (['Armt L', 'Armt P', 'IODCT', 'DQBRN'].includes(registro.categoria)) {
        classeLabel = "Classe V";
      } else if (['Gerador', 'Embarcação', 'Equipamento de Engenharia'].includes(registro.categoria)) {
        classeLabel = "Classe VI";
      } else if (['Comunicações', 'Informática'].includes(registro.categoria)) {
        classeLabel = "Classe VII";
      } else if (['Saúde', 'Remonta/Veterinária'].includes(registro.categoria)) {
        classeLabel = "Classe VIII";
      } else if (isClasseIX) {
        classeLabel = "Classe IX";
      }
      
      tipoDespesa = `${classeLabel} - ${getClasseIILabel(registro.categoria)}`;
      detalhamento = `Efetivo: ${registro.efetivo || 0} | Dias: ${registro.dias_operacao}`;
      valorND30 = (line as LinhaClasseII).valor_nd_30;
      valorND39 = (line as LinhaClasseII).valor_nd_39;
      
      if (isClasseIX) {
        memoriaCalculo = generateClasseIXMemoriaCalculo(registro);
      } else if (classeLabel === "Classe II") {
        memoriaCalculo = generateClasseIIMemoriaCalculo(registro, true);
      } else if (classeLabel === "Classe V") {
        memoriaCalculo = generateClasseVMemoriaCalculo(registro);
      } else if (classeLabel === "Classe VI") {
        memoriaCalculo = generateClasseVIMemoriaCalculo(registro);
      } else if (classeLabel === "Classe VII") {
        memoriaCalculo = generateClasseVIIMemoriaCalculo(registro);
      } else if (classeLabel === "Classe VIII") {
        memoriaCalculo = generateClasseVIIIMemoriaCalculo(registro);
      }
    }

    // Determina a cor da linha
    let rowClass = "";
    if (isClasseI) {
      rowClass = "bg-yellow-50/50";
    } else if (isClasseIII) {
      rowClass = "bg-orange-50/50";
    } else if (isConcessionaria) {
      rowClass = "bg-blue-50/50"; // Nova cor para Concessionária
    } else {
      rowClass = "bg-gray-50/50";
    }

    return (
      <TableRow key={`${omName}-${index}`} className={rowClass}>
        <TableCell className="col-classe text-left font-medium border-r border-black">
          {tipoDespesa}
        </TableCell>
        <TableCell className="col-detalhamento text-left border-r border-black">
          {detalhamento}
        </TableCell>
        <TableCell className="col-memoria text-left border-r border-black">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-pointer text-xs text-muted-foreground hover:text-primary transition-colors line-clamp-1">
                  {memoriaCalculo.split('\n')[0] || 'Clique para ver a memória...'}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xl whitespace-pre-wrap text-xs">
                {memoriaCalculo}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>
        <TableCell className="col-valor-natureza text-center border-r border-black">
          {valorND30 > 0 ? formatCurrency(valorND30) : '-'}
        </TableCell>
        <TableCell className="col-valor-natureza text-center border-r border-black">
          {valorND39 > 0 ? formatCurrency(valorND39) : '-'}
        </TableCell>
        <TableCell className="col-valor-total text-center font-bold">
          {formatCurrency(valorND30 + valorND39)}
        </TableCell>
      </TableRow>
    );
  });
};

const PTrabLogisticoReport: React.FC<PTrabLogisticoReportProps> = ({
  ptrabData,
  nomeRM,
  omsOrdenadas,
  gruposPorOM,
  calcularTotaisPorOM,
  generateClasseIMemoriaCalculo,
  generateClasseIIMemoriaCalculo,
  generateClasseVMemoriaCalculo,
  generateClasseVIMemoriaCalculo,
  generateClasseVIIMemoriaCalculo,
  generateClasseVIIIMemoriaCalculo,
}) => {
  const totalGeralLogistico = useMemo(() => {
    return omsOrdenadas.reduce((acc, omName) => {
      const grupo = gruposPorOM[omName];
      const totaisOM = calcularTotaisPorOM(grupo, omName);
      return acc + totaisOM.total_gnd3;
    }, 0);
  }, [omsOrdenadas, gruposPorOM, calcularTotaisPorOM]);

  return (
    <div className="space-y-6 print:space-y-2">
      {/* Cabeçalho do Relatório (Omitido para brevidade, mas deve existir) */}
      
      <Card className="border-2 border-black print:border-0 print:shadow-none">
        <CardHeader className="p-2 border-b border-black bg-gray-100 print:p-0 print:border-0 print:bg-white">
          <CardTitle className="text-sm font-bold text-center uppercase print:text-xs">
            Relatório Logístico - {ptrabData.numero_ptrab} - {ptrabData.nome_operacao}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="w-full border-collapse border border-black text-xs print:text-[8pt]">
            <TableHeader>
              <TableRow className="bg-gray-200/70 border-b border-black">
                <TableHead className="col-classe text-center font-bold border-r border-black w-[15%]">Classe</TableHead>
                <TableHead className="col-detalhamento text-center font-bold border-r border-black w-[25%]">Detalhamento</TableHead>
                <TableHead className="col-memoria text-center font-bold border-r border-black w-[30%]">Memória de Cálculo</TableHead>
                <TableHead className="col-valor-natureza text-center font-bold border-r border-black w-[10%]">ND 33.90.30</TableHead>
                <TableHead className="col-valor-natureza text-center font-bold border-r border-black w-[10%]">ND 33.90.39</TableHead>
                <TableHead className="col-valor-total text-center font-bold w-[10%]">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {omsOrdenadas.map((omName, omIndex) => {
                const grupo = gruposPorOM[omName];
                const totaisOM = calcularTotaisPorOM(grupo, omName);
                const isRM = omName === nomeRM;
                
                // 1. Linha de Título da OM
                return (
                  <React.Fragment key={omName}>
                    <TableRow className="bg-gray-100 border-t border-black">
                      <TableCell colSpan={6} className="text-left font-bold p-1 border-r border-black">
                        <div className="flex items-center gap-2">
                          <Package className="h-3 w-3 text-primary" />
                          OM: {omName}
                          {isRM && <span className="text-xs text-muted-foreground ml-2">(Região Militar)</span>}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* 2. Linhas de Despesa (Classes I, II, V, VI, VII, VIII, IX, III, Concessionária) */}
                    {renderExpenseLines(
                      omName,
                      grupo,
                      generateClasseIMemoriaCalculo,
                      generateClasseIIMemoriaCalculo,
                      generateClasseVMemoriaCalculo,
                      generateClasseVIMemoriaCalculo,
                      generateClasseVIIMemoriaCalculo,
                      generateClasseVIIIMemoriaCalculo,
                    )}

                    {/* 3. Linha de Soma por ND e Gp de Despesa (Parte Azul) */}
                    <TableRow className="bg-blue-50/50 border-t border-black">
                      <TableCell colSpan={3} className="text-right font-bold border-r border-black">
                        Soma por ND e Gp de Despesa (33.90.30 + 33.90.39)
                      </TableCell>
                      <TableCell className="col-valor-natureza text-center font-bold border-r border-black">
                        {formatCurrency(totaisOM.total_33_90_30)}
                      </TableCell>
                      <TableCell className="col-valor-natureza text-center font-bold border-r border-black">
                        {formatCurrency(totaisOM.total_33_90_39)}
                      </TableCell>
                      <TableCell className="col-valor-total text-center font-bold">
                        {formatCurrency(totaisOM.total_parte_azul)}
                      </TableCell>
                    </TableRow>

                    {/* 4. Linha de Combustível (Apenas se a OM for a RM) */}
                    {isRM && totaisOM.total_combustivel > 0 && (
                      <TableRow className="bg-orange-100 border-t border-black">
                        <TableCell colSpan={3} className="text-right font-bold border-r border-black">
                          Combustível (Classe III)
                        </TableCell>
                        <TableCell className="col-valor-natureza text-center font-bold border-r border-black">
                          {formatCurrency(totaisOM.total_combustivel)}
                        </TableCell>
                        <TableCell className="col-valor-natureza text-center font-bold border-r border-black">
                          -
                        </TableCell>
                        <TableCell className="col-valor-total text-center font-bold">
                          {formatCurrency(totaisOM.total_combustivel)}
                        </TableCell>
                      </TableRow>
                    )}

                    {/* 5. Linha de Total da OM */}
                    <TableRow className="bg-gray-200 border-t-2 border-black">
                      <TableCell colSpan={3} className="text-right font-extrabold text-base border-r border-black">
                        TOTAL OM {omName} (GND 3)
                      </TableCell>
                      <TableCell className="col-valor-natureza text-center font-extrabold text-base border-r border-black">
                        {formatCurrency(totaisOM.total_33_90_30 + (isRM ? totaisOM.total_combustivel : 0))}
                      </TableCell>
                      <TableCell className="col-valor-natureza text-center font-extrabold text-base border-r border-black">
                        {formatCurrency(totaisOM.total_33_90_39)}
                      </TableCell>
                      <TableCell className="col-valor-total text-center font-extrabold text-base">
                        {formatCurrency(totaisOM.total_gnd3)}
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
              
              {/* Linha de Total Geral */}
              <TableRow className="bg-primary/10 border-t-4 border-black">
                <TableCell colSpan={5} className="text-right font-extrabold text-lg">
                  TOTAL GERAL LOGÍSTICO (GND 3)
                </TableCell>
                <TableCell className="col-valor-total text-center font-extrabold text-lg">
                  {formatCurrency(totalGeralLogistico)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PTrabLogisticoReport;