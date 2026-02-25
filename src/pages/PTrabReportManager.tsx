"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Printer, FileText, Download, Share2, Loader2, CheckCircle2 } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { isGhostMode } from "@/lib/ghostStore";
import { runMission06 } from "@/tours/missionTours";
import { markMissionCompleted } from "@/lib/missionUtils";
import { formatCurrency } from "@/lib/formatUtils";
import { toast } from "sonner";

const PTrabReportManager = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const startTour = searchParams.get('startTour') === 'true';

  // Tour da Missão 06
  useEffect(() => {
    if (startTour && isGhostMode() && user?.id) {
      const timer = setTimeout(() => {
        runMission06(user.id, () => {
          markMissionCompleted(6, user.id);
          navigate('/ptrab?showHub=true');
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [startTour, user?.id]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <div className="flex gap-2">
             <Button variant="outline" className="btn-export-pdf"><Download className="mr-2 h-4 w-4" /> PDF</Button>
             <Button variant="outline" className="btn-export-excel"><FileText className="mr-2 h-4 w-4" /> Excel</Button>
             <Button variant="default" className="btn-print"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
          </div>
        </div>

        <Card className="shadow-lg border-2">
          <CardHeader className="bg-primary/5 border-b flex flex-row justify-between items-center">
            <div>
              <CardTitle className="text-xl">Relatório Consolidado do P Trab</CardTitle>
              <p className="text-sm text-muted-foreground">Minuta 001/2026 - OPERAÇÃO SENTINELA</p>
            </div>
            <div className="tour-report-selector">
                <Button variant="outline" size="sm" className="gap-2">
                    Outros Relatórios (Anexos)
                    <Share2 className="h-4 w-4" />
                </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Simulação de Relatório */}
            <div className="p-8 space-y-8 bg-white min-h-[800px]">
              <div className="text-center space-y-1">
                <h2 className="font-bold uppercase">Ministério da Defesa</h2>
                <h2 className="font-bold uppercase">Exército Brasileiro</h2>
                <h3 className="font-medium italic">Plano de Trabalho Operacional e Logístico</h3>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm border p-4 rounded-lg">
                <div><strong>OM Requisitante:</strong> 1º BIS</div>
                <div><strong>Operação:</strong> SENTINELA</div>
                <div><strong>Período:</strong> 01/03/2026 a 15/03/2026</div>
                <div><strong>Valor Total:</strong> {formatCurrency(55150.50)}</div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold border-b pb-2">Resumo de Itens Detalhados</h4>
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Categoria</th>
                      <th className="p-2 text-center">GND</th>
                      <th className="p-2 text-right">Valor Consolidado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b" id="tour-mat-consumo-row">
                      <td className="p-2">Material de Consumo (Construção Civil)</td>
                      <td className="p-2 text-center">3.3.90.30</td>
                      <td className="p-2 text-right">{formatCurrency(1250.50)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">Alimentação e Subsistência (Classe I)</td>
                      <td className="p-2 text-center">3.3.90.30</td>
                      <td className="p-2 text-right">{formatCurrency(45000.00)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">Material Permanente (Equipamentos)</td>
                      <td className="p-2 text-center">4.4.90.52</td>
                      <td className="p-2 text-right">{formatCurrency(8900.00)}</td>
                    </tr>
                  </tbody>
                  <tfoot className="font-bold bg-muted/50">
                    <tr>
                      <td colSpan={2} className="p-2 text-right">TOTAL GERAL DO PLANO:</td>
                      <td className="p-2 text-right">{formatCurrency(55150.50)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="pt-20 text-center">
                <div className="w-64 h-px bg-black mx-auto mb-2" />
                <p className="font-bold uppercase">Comandante da OM</p>
                <p className="text-xs">Ordenador de Despesas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PTrabReportManager;