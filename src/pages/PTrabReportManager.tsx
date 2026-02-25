"use client";

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Printer, FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { useSession } from '@/components/SessionContextProvider';
import { runMission06 } from '@/tours/missionTours';
import { isGhostMode } from '@/lib/ghostStore';
import PageMetadata from '@/components/PageMetadata';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from '@/lib/formatUtils';
import { toast } from 'sonner';

const PTrabReportManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useSession();
  const [isTourRunning, setIsTourRunning] = useState(false);

  useEffect(() => {
    const startTour = searchParams.get('startTour') === 'true';
    const isGhost = isGhostMode();
    
    if (startTour && isGhost && user?.id && !isTourRunning) {
      setIsTourRunning(true);
      // Pequeno delay para garantir que o DOM renderizou os IDs necessários
      const timer = setTimeout(() => {
        runMission06(user.id, () => {
          setIsTourRunning(false);
          toast.success("Missão 06 concluída com sucesso!");
          navigate('/ptrab?showHub=true');
        });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [searchParams, user?.id, navigate, isTourRunning]);

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <PageMetadata title="Relatórios do P Trab" description="Visualize e exporte os relatórios detalhados do seu P Trab." />
      
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="btn-export-pdf"><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
            <Button variant="outline" className="btn-export-excel"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</Button>
            <Button className="btn-print"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-1 h-fit tour-report-selector">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Relatórios Disponíveis</CardTitle></CardHeader>
            <CardContent className="p-0">
              <nav className="flex flex-col">
                <Button variant="ghost" className="justify-start rounded-none h-12 border-l-4 border-primary bg-primary/5">P Trab Consolidado</Button>
                <Button variant="ghost" className="justify-start rounded-none h-12 border-l-4 border-transparent">Detalhamento Logístico</Button>
                <Button variant="ghost" className="justify-start rounded-none h-12 border-l-4 border-transparent">Detalhamento Operacional</Button>
                <Button variant="ghost" className="justify-start rounded-none h-12 border-l-4 border-transparent">Memórias de Cálculo</Button>
                <Button variant="ghost" className="justify-start rounded-none h-12 border-l-4 border-transparent">Anexo de DOR</Button>
              </nav>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 shadow-sm bg-white min-h-[800px]">
            <CardContent className="p-12 space-y-8">
              <div className="text-center space-y-2 border-b pb-6">
                <h1 className="text-2xl font-bold uppercase">Plano de Trabalho nº 001/2026</h1>
                <p className="text-lg">OPERAÇÃO SENTINELA - 1º BIS</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold border-b text-primary">1. RESUMO DE CUSTOS</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow id="tour-mat-consumo-row" className="bg-yellow-50/30">
                      <TableCell className="font-medium">Material de Consumo (Missão 03)</TableCell>
                      <TableCell className="text-right font-bold text-orange-600">{formatCurrency(1250.50)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Logística Classe I-IX</TableCell>
                      <TableCell className="text-right">{formatCurrency(45000.50)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50 border-t-2">
                      <TableCell className="font-bold">TOTAL GERAL</TableCell>
                      <TableCell className="text-right font-bold text-lg">{formatCurrency(46251.00)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-4 pt-8">
                <h3 className="font-bold border-b text-primary">2. MEMÓRIA DE CÁLCULO - MATERIAL DE CONSTRUÇÃO</h3>
                <div className="p-4 bg-muted/20 border-l-4 border-primary rounded text-sm italic">
                  Cálculo automático: 5 Unid. de Cimento Portland x {formatCurrency(42.50)} (Pregão 005/25 - UASG 160222) + Insumos de obra conforme planejamento operacional...
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PTrabReportManager;