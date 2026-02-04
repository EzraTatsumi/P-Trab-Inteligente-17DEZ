import React, { useMemo } from 'react';
import { PTrabData, HorasVooRegistro } from '@/pages/PTrabReportManager';
import { formatCurrency, formatNumber } from '@/lib/formatUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plane } from 'lucide-react';

interface PTrabHorasVooReportProps {
  ptrabData: PTrabData;
  omsOrdenadas: string[];
  gruposPorOM: Record<string, HorasVooRegistro[]>;
  fileSuffix: string;
}

const PTrabHorasVooReport: React.FC<PTrabHorasVooReportProps> = ({
  ptrabData,
  omsOrdenadas,
  gruposPorOM,
  fileSuffix,
}) => {
  const registros = useMemo(() => omsOrdenadas.flatMap(om => gruposPorOM[om]), [omsOrdenadas, gruposPorOM]);

  const totalGeral = useMemo(() => {
    return registros.reduce((acc, r) => acc + r.valor_total, 0);
  }, [registros]);

  const renderOMSection = (om: string, registros: HorasVooRegistro[]) => {
    const omTotal = registros.reduce((acc, r) => acc + r.valor_total, 0);
    const omTotalND30 = registros.reduce((acc, r) => acc + r.valor_nd_30, 0);
    const omTotalND39 = registros.reduce((acc, r) => acc + r.valor_nd_39, 0);

    return (
      <div key={om} className="mb-8 break-inside-avoid-page">
        <h4 className="text-lg font-semibold mb-4 p-2 bg-muted/50 border-l-4 border-purple-500">
          OM: {om}
        </h4>

        <Table className="w-full text-sm">
          <TableHeader>
            <TableRow className="bg-gray-100 hover:bg-gray-100 print:bg-gray-100">
              <TableHead className="w-[100px]">UG</TableHead>
              <TableHead className="w-[150px]">Tipo ANV</TableHead>
              <TableHead className="w-[100px]">Horas Voo</TableHead>
              <TableHead className="w-[150px]">Município Destino</TableHead>
              <TableHead className="w-[100px]">ND 33.90.30</TableHead>
              <TableHead className="w-[100px]">ND 33.90.39</TableHead>
              <TableHead className="w-[120px] text-right">Valor Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.map((registro, index) => (
              <TableRow key={registro.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <TableCell>{registro.ug}</TableCell>
                <TableCell>{registro.tipo_anv}</TableCell>
                <TableCell>{formatNumber(registro.quantidade_hv, 2)}</TableCell>
                <TableCell>{registro.municipio}</TableCell>
                <TableCell>{formatCurrency(registro.valor_nd_30)}</TableCell>
                <TableCell>{formatCurrency(registro.valor_nd_39)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(registro.valor_total)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold bg-purple-50 hover:bg-purple-50 print:bg-purple-50">
              <TableCell colSpan={4} className="text-right">TOTAL {om}</TableCell>
              <TableCell>{formatCurrency(omTotalND30)}</TableCell>
              <TableCell>{formatCurrency(omTotalND39)}</TableCell>
              <TableCell className="text-right">{formatCurrency(omTotal)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        
        {/* Seção de Detalhamento/Memória de Cálculo (Opcional, mas útil) */}
        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
            <h5 className="font-semibold text-sm">Detalhamento dos Registros:</h5>
            {registros.map(registro => (
                <div key={registro.id} className="border-l-2 pl-2 ml-2">
                    <p className="font-medium">
                        {registro.tipo_anv} ({formatNumber(registro.quantidade_hv, 2)} HV) em {registro.municipio} - {registro.ug}
                    </p>
                    <p className="whitespace-pre-wrap">{registro.detalhamento_customizado || registro.detalhamento || 'Sem detalhamento específico.'}</p>
                </div>
            ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-8 print:p-0 print:space-y-4" id={`report-horas-voo-${ptrabData.id}`}>
      <header className="text-center mb-8 print:mb-4 print:border-b print:pb-2">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2 print:text-xl">
          <Plane className="h-6 w-6 text-purple-500" />
          P Trab Horas de Voo ({fileSuffix})
        </h1>
        <h2 className="text-xl font-semibold text-muted-foreground print:text-lg">{ptrabData.numero_ptrab} - {ptrabData.nome_om}</h2>
        <p className="text-sm text-muted-foreground">
          Período: {ptrabData.periodo_inicio} a {ptrabData.periodo_fim}
        </p>
      </header>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-xl">Resumo Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="border-l-4 border-purple-500 pl-3">
              <p className="text-sm text-muted-foreground">Total de Horas de Voo</p>
              <p className="text-2xl font-bold">{formatNumber(registros.reduce((acc, r) => acc + r.quantidade_hv, 0), 2)} HV</p>
            </div>
            <div className="border-l-4 border-purple-500 pl-3">
              <p className="text-sm text-muted-foreground">Total ND 33.90.30</p>
              <p className="text-2xl font-bold">{formatCurrency(registros.reduce((acc, r) => acc + r.valor_nd_30, 0))}</p>
            </div>
            <div className="border-l-4 border-purple-500 pl-3">
              <p className="text-sm text-muted-foreground">Total ND 33.90.39</p>
              <p className="text-2xl font-bold">{formatCurrency(registros.reduce((acc, r) => acc + r.valor_nd_39, 0))}</p>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex justify-between items-center">
            <p className="text-lg font-semibold">TOTAL GERAL (Horas de Voo)</p>
            <p className="text-3xl font-extrabold text-purple-600">{formatCurrency(totalGeral)}</p>
          </div>
        </CardContent>
      </Card>

      <section className="mt-8 print:mt-0">
        <h3 className="text-xl font-bold mb-4 print:text-lg print:mb-2">Detalhamento por Organização Militar</h3>
        <div className="space-y-6 print:space-y-4">
          {omsOrdenadas.map(om => renderOMSection(om, gruposPorOM[om]))}
        </div>
      </section>
      
      <footer className="mt-12 pt-4 border-t print:mt-4 print:pt-2">
        <div className="flex justify-end">
          <Card className="w-full max-w-sm bg-purple-50 print:bg-white print:border-2">
            <CardContent className="p-4">
              <p className="text-lg font-semibold">TOTAL GERAL</p>
              <p className="text-3xl font-extrabold text-purple-600">{formatCurrency(totalGeral)}</p>
            </CardContent>
          </Card>
        </div>
      </footer>
    </div>
  );
};

export default PTrabHorasVooReport;