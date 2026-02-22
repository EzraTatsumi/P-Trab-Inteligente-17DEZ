"use client";

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Save, Plus, Trash2, FileText, Package, Pencil, Search, Info, LayoutGrid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { GHOST_DATA, isGhostMode } from "@/lib/ghostStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PTrabCostSummary } from "@/components/PTrabCostSummary";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPTrabData } from "@/lib/ptrabUtils";
import PageMetadata from "@/components/PageMetadata";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatUtils";
import { fetchUserCredits } from "@/lib/creditUtils";
import { useSession } from "@/components/SessionContextProvider";

const MaterialConsumoForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const { user } = useSession();
  const queryClient = useQueryClient();
  
  const [loading, setLoading] = useState(true);
  const [selectedOm, setSelectedOm] = useState<OMData | null>(null);
  const [fase, setFase] = useState("");
  
  // Estado para Grupos de Consumo (Padrão Real)
  const [grupos, setGrupos] = useState<any[]>([]);

  // Busca dados do P Trab para o cabeçalho
  const { data: ptrabData } = useQuery({
    queryKey: ['pTrab', ptrabId],
    queryFn: () => isGhostMode() ? Promise.resolve(GHOST_DATA.p_trab_exemplo) : fetchPTrabData(ptrabId!),
    enabled: !!ptrabId || isGhostMode(),
  });

  // Busca créditos para o resumo lateral
  const { data: credits } = useQuery({
    queryKey: ['userCredits', user?.id],
    queryFn: () => isGhostMode() ? Promise.resolve(GHOST_DATA.totais_exemplo) : fetchUserCredits(user!.id),
    enabled: !!user?.id || isGhostMode(),
  });

  // Sincronismo do Tour: Avança quando a página está pronta
  useEffect(() => {
    if (!loading && isGhostMode()) {
      const timer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tour:avancar'));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => {
    if (!ptrabId && !isGhostMode()) {
      navigate('/ptrab');
      return;
    }
    
    if (isGhostMode()) {
      // Simula um grupo já existente para o tour
      setGrupos([{
        id: "ghost-group-1",
        group_name: "Material de Construção",
        group_purpose: "Reparos nas instalações do destacamento",
        itens: [GHOST_DATA.missao_02.item_cimento]
      }]);
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
          {/* Coluna da Esquerda: Dados e Resumo de Custos (Real) */}
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
                creditGND3={credits?.credit_gnd3 || 0}
                creditGND4={credits?.credit_gnd4 || 0}
                onOpenCreditDialog={() => {}} // Desabilitado no tour
              />
            )}
          </div>

          {/* Coluna da Direita: O Formulário Real com Grupos */}
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
                  <CardTitle className="text-base flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-primary" />
                    Seção 2: Grupos de Consumo
                  </CardTitle>
                  <CardDescription>Agrupe os itens por finalidade ou subitem da ND.</CardDescription>
                </div>
                <Button size="sm" disabled={!selectedOm || !fase} className="gap-2 btn-criar-grupo-material">
                  <Plus className="h-4 w-4" />
                  Criar Grupo
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {grupos.length > 0 ? (
                  grupos.map((grupo, gIdx) => (
                    <div key={grupo.id} className="border rounded-lg overflow-hidden">
                      <div className="bg-muted/30 p-3 border-b flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-sm">{grupo.group_name}</h4>
                          <p className="text-xs text-muted-foreground">{grupo.group_purpose}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/10">
                            <TableHead className="text-xs">Item</TableHead>
                            <TableHead className="text-center text-xs">Qtd</TableHead>
                            <TableHead className="text-right text-xs">Vlr Unit.</TableHead>
                            <TableHead className="text-right text-xs">Total</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {grupo.itens.map((item: any, iIdx: number) => (
                            <TableRow key={iIdx}>
                              <TableCell className="py-2">
                                <div className="text-xs font-medium">{item.descricao_item}</div>
                                <div className="text-[10px] text-muted-foreground">CATMAT: {item.codigo_catmat}</div>
                              </TableCell>
                              <TableCell className="text-center text-xs">10</TableCell>
                              <TableCell className="text-right text-xs">{formatCurrency(item.valor_unitario)}</TableCell>
                              <TableCell className="text-right text-xs font-bold">{formatCurrency(item.valor_unitario * 10)}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-6 w-6"><Trash2 className="h-3 w-3" /></Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={5} className="p-2">
                              <Button variant="outline" size="sm" className="w-full h-8 text-xs border-dashed">
                                <Plus className="h-3 w-3 mr-1" /> Adicionar Item ao Grupo
                              </Button>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  ))
                ) : (
                  <div className="h-32 flex items-center justify-center border-2 border-dashed rounded-md">
                    <p className="text-muted-foreground text-sm italic">
                      {!selectedOm || !fase 
                        ? "Preencha a Seção 1 para habilitar a criação de grupos." 
                        : "Nenhum grupo de consumo criado ainda."}
                    </p>
                  </div>
                )}
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