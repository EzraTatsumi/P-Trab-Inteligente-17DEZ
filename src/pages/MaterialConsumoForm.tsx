"use client";

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Save, Plus, Trash2, FileText, Package, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { GHOST_DATA, isGhostMode } from "@/lib/ghostStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PTrabCostSummary } from "@/components/PTrabCostSummary";
import { useQuery } from "@tanstack/react-query";
import { fetchPTrabData } from "@/lib/ptrabUtils";
import PageMetadata from "@/components/PageMetadata";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MaterialConsumoForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const [loading, setLoading] = useState(true);
  const [selectedOm, setSelectedOm] = useState<OMData | null>(null);
  const [fase, setFase] = useState("");

  // Busca dados do P Trab para o cabeçalho
  const { data: ptrabData } = useQuery({
    queryKey: ['pTrab', ptrabId],
    queryFn: () => isGhostMode() ? Promise.resolve(GHOST_DATA.p_trab_exemplo) : fetchPTrabData(ptrabId!),
    enabled: !!ptrabId || isGhostMode(),
  });

  // Avança o tour assim que o formulário carregar e os dados estiverem prontos
  useEffect(() => {
    if (!loading && isGhostMode()) {
      const timer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tour:avancar'));
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => {
    if (!ptrabId && !isGhostMode()) {
      navigate('/ptrab');
      return;
    }
    setLoading(false);
  }, [ptrabId, navigate]);

  const handleSave = () => {
    toast.success("Dados salvos com sucesso!");
    navigate(`/ptrab/form?ptrabId=${ptrabId}`);
  };

  const formatDate = (date: string) => date ? new Date(date).toLocaleDateString('pt-BR') : "";
  const calculateDays = (inicio: string, fim: string) => {
    if (!inicio || !fim) return 0;
    const start = new Date(inicio);
    const end = new Date(fim);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-4 px-4">
      <PageMetadata title="Detalhamento de Material de Consumo" description="Lance as necessidades de material de consumo para a operação." />
      
      <div className="container max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para o P Trab
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna da Esquerda: Dados e Resumo */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="shadow-sm border-primary/10">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Dados do P Trab
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <Label className="text-muted-foreground text-xs">Operação</Label>
                  <p className="font-medium">{ptrabData?.nome_operacao}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Período</Label>
                  <p className="font-medium">
                    {ptrabData && `${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} (${calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim)} dias)`}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Efetivo</Label>
                  <p className="font-medium">{ptrabData?.efetivo_empregado}</p>
                </div>
              </CardContent>
            </Card>

            {ptrabId && (
              <PTrabCostSummary 
                ptrabId={ptrabId} 
                creditGND3={isGhostMode() ? GHOST_DATA.totais_exemplo.credit_gnd3 : 0}
                creditGND4={isGhostMode() ? GHOST_DATA.totais_exemplo.credit_gnd4 : 0}
              />
            )}
          </div>

          {/* Coluna da Direita: O Formulário Real */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="secao-1-form-material shadow-md border-primary/20">
              <CardHeader>
                <CardTitle>Seção 1: Identificação e Fase</CardTitle>
                <CardDescription>Selecione a OM responsável pelo gasto e a fase da atividade.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="font-semibold">Organização Militar Responsável</Label>
                    {isGhostMode() ? (
                      <Select onValueChange={(val) => setSelectedOm(GHOST_DATA.oms_exemplo.find(o => o.id === val) as any)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione a OM..." />
                        </SelectTrigger>
                        <SelectContent>
                          {GHOST_DATA.oms_exemplo.map(om => (
                            <SelectItem key={om.id} value={om.id}>{om.nome_om}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <OmSelector 
                        selectedOmId={selectedOm?.id}
                        onChange={setSelectedOm}
                        placeholder="Selecione a OM..."
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold">Fase da Atividade</Label>
                    <Select value={fase} onValueChange={setFase}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a fase..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preparacao">Preparação</SelectItem>
                        <SelectItem value="execucao">Execução</SelectItem>
                        <SelectItem value="desmobilizacao">Desmobilização</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Seção 2: Itens de Material de Consumo</CardTitle>
                  <CardDescription>Adicione os itens necessários para esta OM e fase.</CardDescription>
                </div>
                <Button size="sm" disabled={!selectedOm || !fase} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Item
                </Button>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Descrição do Item</TableHead>
                        <TableHead className="text-center">Qtd</TableHead>
                        <TableHead className="text-right">Vlr Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">
                          {!selectedOm || !fase 
                            ? "Preencha a Seção 1 para habilitar a adição de itens." 
                            : "Nenhum item adicionado ainda."}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}>Cancelar</Button>
              <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
                <Save className="mr-2 h-4 w-4" />
                Salvar e Continuar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaterialConsumoForm;