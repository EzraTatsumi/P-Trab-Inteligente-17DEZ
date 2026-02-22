"use client";

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Loader2, Save, Package, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPTrabData } from "@/lib/ptrabUtils";
import { formatCurrency } from "@/lib/formatUtils";
import { isGhostMode, GHOST_DATA } from "@/lib/ghostStore";
import MaterialConsumoGroupForm from "@/components/MaterialConsumoGroupForm";
import { MaterialConsumoGroup } from "@/types/materialConsumo";
import { DiretrizMaterialConsumo } from "@/types/diretrizesMaterialConsumo";
import PageMetadata from "@/components/PageMetadata";

const MaterialConsumoForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const { user } = useSession();
  const queryClient = useQueryClient();

  const [isSaving, setIsSaving] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MaterialConsumoGroup | null>(null);

  const [formData, setFormData] = useState({
    organizacao: "",
    ug: "",
    fase_atividade: "",
    dias_operacao: 0,
    efetivo: 0,
    grupos: [] as MaterialConsumoGroup[],
  });

  // Expondo funções para o Tour
  useEffect(() => {
    (window as any).forcePrefillMission03 = () => {
      setFormData(prev => ({
        ...prev,
        organizacao: "1º BIS",
        ug: "160222",
        fase_atividade: "Execução"
      }));
    };
    (window as any).prefillSection2 = () => {
      setFormData(prev => ({
        ...prev,
        dias_operacao: 15,
        efetivo: 150
      }));
    };
    return () => {
      delete (window as any).forcePrefillMission03;
      delete (window as any).prefillSection2;
    };
  }, []);

  const { data: ptrab, isLoading: isLoadingPTrab } = useQuery({
    queryKey: ['ptrab', ptrabId],
    queryFn: () => isGhostMode() ? Promise.resolve(GHOST_DATA.p_trab_exemplo) : fetchPTrabData(ptrabId!),
    enabled: !!ptrabId || isGhostMode(),
  });

  const { data: diretrizes = [] } = useQuery({
    queryKey: ['diretrizesMaterialConsumo', 2026], // Usando ano do ghost
    queryFn: async () => {
      if (isGhostMode()) return GHOST_DATA.missao_03.subitens_lista;
      return []; // Implementar busca real se necessário
    },
    enabled: isGhostMode(),
  });

  const handleAddGroup = () => {
    setIsAddingGroup(true);
    if (isGhostMode()) {
      // Avança do passo 6 para o 7 ao clicar no botão
      window.dispatchEvent(new CustomEvent('tour:avancar'));
    }
  };

  const handleSaveGroup = (group: MaterialConsumoGroup) => {
    setFormData(prev => {
      const existingIndex = prev.grupos.findIndex(g => g.id === group.id);
      if (existingIndex >= 0) {
        const newGrupos = [...prev.grupos];
        newGrupos[existingIndex] = group;
        return { ...prev, grupos: newGrupos };
      }
      return { ...prev, grupos: [...prev.grupos, group] };
    });
    setIsAddingGroup(false);
    setEditingGroup(null);
    
    if (isGhostMode()) {
      // Avança do passo 9 para o final da missão após salvar o grupo
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tour:avancar'));
      }, 300);
    }
  };

  const handleRemoveGroup = (id: string) => {
    setFormData(prev => ({
      ...prev,
      grupos: prev.grupos.filter(g => g.id !== id)
    }));
  };

  const totalGeral = formData.grupos.reduce((acc, g) => acc + (g.valor_total || 0), 0);

  if (isLoadingPTrab) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <PageMetadata title="Material de Consumo" description="Detalhamento de necessidades de material de consumo." />
      
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Material de Consumo</h1>
        </div>

        <Card className="secao-1-form-material">
          <CardHeader>
            <CardTitle className="text-lg">Identificação e Atividade</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Organização Militar</Label>
              <Input value={formData.organizacao} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>UG</Label>
              <Input value={formData.ug} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Fase da Atividade</Label>
              <Input value={formData.fase_atividade} readOnly className="bg-muted" />
            </div>
          </CardContent>
        </Card>

        <Card className="secao-2-planejamento">
          <CardHeader>
            <CardTitle className="text-lg">Planejamento de Custos</CardTitle>
            <CardDescription>Defina o período e o efetivo para o cálculo dos grupos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dias de Operação</Label>
                <Input 
                  type="number" 
                  value={formData.dias_operacao || ""} 
                  onChange={(e) => setFormData({...formData, dias_operacao: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>Efetivo</Label>
                <Input 
                  type="number" 
                  value={formData.efetivo || ""} 
                  onChange={(e) => setFormData({...formData, efetivo: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Grupos de Aquisição
                </h3>
                {!isAddingGroup && !editingGroup && (
                  <Button onClick={handleAddGroup} size="sm" className="btn-criar-grupo-tour">
                    <Plus className="mr-2 h-4 w-4" />
                    Criar Novo Grupo de Aquisição
                  </Button>
                )}
              </div>

              {isAddingGroup || editingGroup ? (
                <MaterialConsumoGroupForm 
                  group={editingGroup || undefined}
                  onSave={handleSaveGroup}
                  onCancel={() => { setIsAddingGroup(false); setEditingGroup(null); }}
                  diretrizes={diretrizes as any}
                />
              ) : (
                <div className="space-y-4">
                  {formData.grupos.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                      Nenhum grupo de aquisição criado.
                    </div>
                  ) : (
                    formData.grupos.map(grupo => (
                      <Card key={grupo.id} className="border-l-4 border-l-primary">
                        <CardContent className="p-4 flex justify-between items-center">
                          <div>
                            <p className="font-bold">{grupo.nome_grupo}</p>
                            <p className="text-sm text-muted-foreground">{grupo.itens.length} itens cadastrados</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="font-bold text-primary">{formatCurrency(grupo.valor_total)}</p>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setEditingGroup(grupo)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveGroup(grupo.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center p-6 bg-primary/5 rounded-lg border border-primary/20">
          <div>
            <p className="text-sm text-muted-foreground">Total Geral de Material de Consumo</p>
            <p className="text-3xl font-bold text-primary">{formatCurrency(totalGeral)}</p>
          </div>
          <Button size="lg" disabled={isSaving || formData.grupos.length === 0}>
            <Save className="mr-2 h-5 w-5" />
            Salvar Tudo
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MaterialConsumoForm;