"use client";

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Save, Loader2, Package, Calculator, Info, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MaterialConsumoRecord, MaterialConsumoGroup } from "@/types/materialConsumo";
import { DiretrizMaterialConsumo } from "@/types/diretrizesMaterialConsumo";
import MaterialConsumoGroupForm from "@/components/MaterialConsumoGroupForm";
import MaterialConsumoGroupCard from "@/components/MaterialConsumoGroupCard";
import { formatCurrency, calculateDays } from "@/lib/formatUtils";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { isGhostMode } from "@/lib/ghostStore";
import { cn } from "@/lib/utils";

const MaterialConsumoForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const { user } = useSession();
  const queryClient = useQueryClient();

  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [editingGroupIndex, setEditingGroupIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<MaterialConsumoRecord>>({
    organizacao: "",
    ug: "",
    om_detentora: "",
    ug_detentora: "",
    dias_operacao: 1,
    efetivo: 0,
    fase_atividade: "",
    group_name: "",
    group_purpose: "",
    itens_aquisicao: [],
    valor_total: 0,
    valor_nd_30: 0,
    valor_nd_39: 0,
  });

  const [groups, setGroups] = useState<MaterialConsumoGroup[]>([]);

  // Expondo preenchimento para o Tour
  useEffect(() => {
    (window as any).forcePrefillMission03 = () => {
      setFormData(prev => ({
        ...prev,
        organizacao: "1º BIS",
        ug: "160222",
        fase_atividade: "Concentração Estratégica"
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

  const { data: pTrab, isLoading: isLoadingPTrab } = useQuery({
    queryKey: ['pTrab', ptrabId],
    queryFn: async () => {
      if (isGhostMode()) return { id: 'ghost', nome_om: '1º BIS', codug_om: '160222', periodo_inicio: '2026-03-01', periodo_fim: '2026-03-15', efetivo_empregado: '150' };
      const { data, error } = await supabase.from('p_trab').select('*').eq('id', ptrabId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!ptrabId || isGhostMode(),
  });

  const { data: diretrizes = [] } = useQuery({
    queryKey: ['diretrizesMaterialConsumo', pTrab?.periodo_inicio ? new Date(pTrab.periodo_inicio).getFullYear() : new Date().getFullYear()],
    queryFn: async () => {
      const year = pTrab?.periodo_inicio ? new Date(pTrab.periodo_inicio).getFullYear() : new Date().getFullYear();
      if (isGhostMode()) return [];
      const { data, error } = await supabase.from('diretrizes_material_consumo').select('*').eq('user_id', user?.id).eq('ano_referencia', year).eq('ativo', true);
      if (error) throw error;
      return data as DiretrizMaterialConsumo[];
    },
    enabled: (!!pTrab && !!user) || isGhostMode(),
  });

  useEffect(() => {
    if (pTrab && !isGhostMode()) {
      setFormData(prev => ({
        ...prev,
        organizacao: pTrab.nome_om,
        ug: pTrab.codug_om || "",
        dias_operacao: calculateDays(pTrab.periodo_inicio, pTrab.periodo_fim),
        efetivo: parseInt(pTrab.efetivo_empregado) || 0,
      }));
    }
  }, [pTrab]);

  const handleAddGroup = (group: MaterialConsumoGroup) => {
    if (editingGroupIndex !== null) {
      const newGroups = [...groups];
      newGroups[editingGroupIndex] = group;
      setGroups(newGroups);
      setEditingGroupIndex(null);
    } else {
      setGroups([...groups, group]);
    }
    setIsAddingGroup(false);
  };

  const handleEditGroup = (index: number) => {
    setEditingGroupIndex(index);
    setIsAddingGroup(true);
  };

  const handleRemoveGroup = (index: number) => {
    setGroups(groups.filter((_, i) => i !== index));
  };

  const totalGeral = groups.reduce((acc, group) => acc + (group.valor_total || 0), 0);

  const handleSave = async () => {
    if (!formData.fase_atividade || groups.length === 0) {
      toast.error("Preencha a fase da atividade e adicione pelo menos um grupo.");
      return;
    }

    setIsSaving(true);
    try {
      if (isGhostMode()) {
        toast.success("Simulação: Registro salvo com sucesso!");
        navigate(`/ptrab/form?ptrabId=${ptrabId}`);
        return;
      }

      const recordData = {
        p_trab_id: ptrabId,
        organizacao: formData.organizacao,
        ug: formData.ug,
        dias_operacao: formData.dias_operacao,
        efetivo: formData.efetivo,
        fase_atividade: formData.fase_atividade,
        valor_total: totalGeral,
        itens_aquisicao: groups as any,
      };

      const { error } = await supabase.from('material_consumo_registros').insert([recordData]);
      if (error) throw error;

      await updatePTrabStatusIfAberto(ptrabId!);
      toast.success("Registro de Material de Consumo salvo!");
      navigate(`/ptrab/form?ptrabId=${ptrabId}`);
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingPTrab) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
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
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Identificação e Período
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Organização Militar</Label>
              <Input value={formData.organizacao} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>CODUG</Label>
              <Input value={formData.ug} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Fase da Atividade *</Label>
              <Input 
                value={formData.fase_atividade} 
                onChange={(e) => setFormData({...formData, fase_atividade: e.target.value})}
                placeholder="Ex: Concentração Estratégica"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="secao-2-planejamento">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Planejamento de Grupos
            </CardTitle>
            <CardDescription>
              Agrupe os materiais por finalidade para facilitar a organização do P Trab.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-dashed">
              <div className="space-y-2">
                <Label>Dias de Operação</Label>
                <Input 
                  type="number" 
                  value={formData.dias_operacao} 
                  onChange={(e) => setFormData({...formData, dias_operacao: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>Efetivo Apoiado</Label>
                <Input 
                  type="number" 
                  value={formData.efetivo} 
                  onChange={(e) => setFormData({...formData, efetivo: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>

            <div className="space-y-4">
              {groups.map((group, index) => (
                <MaterialConsumoGroupCard 
                  key={index}
                  group={group}
                  onEdit={() => handleEditGroup(index)}
                  onRemove={() => handleRemoveGroup(index)}
                />
              ))}

              {isAddingGroup ? (
                <MaterialConsumoGroupForm 
                  group={editingGroupIndex !== null ? groups[editingGroupIndex] : undefined}
                  onSave={handleAddGroup}
                  onCancel={() => {
                    setIsAddingGroup(false);
                    setEditingGroupIndex(null);
                  }}
                  diretrizes={diretrizes}
                />
              ) : (
                <Button 
                  onClick={() => {
                    setIsAddingGroup(true);
                    if (isGhostMode()) {
                      window.dispatchEvent(new CustomEvent('tour:avancar'));
                    }
                  }}
                  className="w-full md:w-auto btn-criar-grupo-tour"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Novo Grupo de Aquisição
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {groups.length > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Geral de Material de Consumo</p>
                <h2 className="text-3xl font-bold text-primary">{formatCurrency(totalGeral)}</h2>
              </div>
              <Button size="lg" onClick={handleSave} disabled={isSaving} className="w-full md:w-auto">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Tudo e Voltar
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MaterialConsumoForm;