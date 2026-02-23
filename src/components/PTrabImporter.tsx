"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  Loader2, 
  Plus, 
  Trash2, 
  GripVertical, 
  ChevronRight, 
  Package, 
  Briefcase, 
  CheckCircle2,
  AlertCircle,
  ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";
import { GHOST_DATA, isGhostMode } from "@/lib/ghostStore";

// Tipos para os registros do P Trab
interface PTrabRecord {
  id: string;
  organizacao: string;
  ug: string;
  valor_total: number;
  categoria?: string;
  descricao_item?: string;
  group_name?: string;
  [key: string]: any;
}

// Tipo para um item agrupado por tipo (ex: "Material de Consumo")
export interface DorTypeItem {
  type: string;
  total: number;
  originalRecords: PTrabRecord[];
}

// Tipo para um grupo customizado no DOR
export interface DorGroup {
  id: string;
  name: string;
  items: DorTypeItem[];
}

interface PTrabImporterProps {
  isOpen: boolean;
  onClose: () => void;
  ptrabId: string;
  onImportConcluded: (groups: DorGroup[], selectedGnd: number) => void;
  initialGroups?: DorGroup[];
}

export const PTrabImporter: React.FC<PTrabImporterProps> = ({
  isOpen,
  onClose,
  ptrabId,
  onImportConcluded,
  initialGroups = []
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedGnd, setSelectedGnd] = useState<number>(3);
  const [availableItems, setAvailableItems] = useState<DorTypeItem[]>([]);
  const [groups, setGroups] = useState<DorGroup[]>(initialGroups);
  const [newGroupName, setNewGroupName] = useState("");

  // Carregar dados do P Trab baseados no GND selecionado
  useEffect(() => {
    if (!isOpen) return;

    const loadPTrabData = async () => {
      setLoading(true);
      try {
        let records: PTrabRecord[] = [];

        if (isGhostMode()) {
          // Simulação para o Tour
          if (selectedGnd === 3) {
            records = [
              { 
                id: "ghost-rec-1", 
                organizacao: "1º BIS", 
                ug: "160222", 
                valor_total: 1250.50, 
                group_name: "Material de Construção",
                type: "Material de Consumo" 
              }
            ];
          }
        } else {
          // Lógica real do Supabase
          const tables = selectedGnd === 3 
            ? [
                'classe_i_registros', 'classe_ii_registros', 'classe_iii_registros', 
                'classe_v_registros', 'classe_vi_registros', 'classe_vii_registros',
                'classe_viii_saude_registros', 'classe_viii_remonta_registros',
                'classe_ix_registros', 'diaria_registros', 'verba_operacional_registros',
                'passagem_registros', 'concessionaria_registros', 'horas_voo_registros',
                'material_consumo_registros', 'complemento_alimentacao_registros',
                'servicos_terceiros_registros'
              ]
            : ['material_permanente_registros'];

          const results = await Promise.all(
            tables.map(table => 
              supabase.from(table as any).select('*').eq('p_trab_id', ptrabId)
            )
          );

          results.forEach((res, idx) => {
            if (res.data) {
              const tableRecords = res.data.map(r => ({
                ...r,
                type: tables[idx].replace('_registros', '').replace(/_/g, ' ').toUpperCase()
              }));
              records = [...records, ...tableRecords];
            }
          });
        }

        // Agrupar registros por tipo ou por group_name (se existir)
        const aggregated: Record<string, DorTypeItem> = {};
        
        records.forEach(rec => {
          const typeKey = rec.group_name || rec.type || "Outros";
          if (!aggregated[typeKey]) {
            aggregated[typeKey] = { type: typeKey, total: 0, originalRecords: [] };
          }
          aggregated[typeKey].total += Number(rec.valor_total);
          aggregated[typeKey].originalRecords.push(rec);
        });

        // Filtrar itens que já estão em algum grupo
        const itemsInGroups = new Set(groups.flatMap(g => g.items.map(i => i.type)));
        const filteredAvailable = Object.values(aggregated).filter(item => !itemsInGroups.has(item.type));

        setAvailableItems(filteredAvailable);
      } catch (error) {
        console.error("Erro ao carregar dados para importação:", error);
        toast.error("Falha ao carregar dados do P Trab.");
      } finally {
        setLoading(false);
      }
    };

    loadPTrabData();
  }, [isOpen, ptrabId, selectedGnd, groups]);

  const handleAddGroup = () => {
    if (!newGroupName.trim()) {
      toast.error("Informe um nome para o grupo.");
      return;
    }
    const newGroup: DorGroup = {
      id: Math.random().toString(36).substring(2, 9),
      name: newGroupName.trim(),
      items: []
    };
    setGroups([...groups, newGroup]);
    setNewGroupName("");
  };

  const handleRemoveGroup = (groupId: string) => {
    const groupToRemove = groups.find(g => g.id === groupId);
    if (groupToRemove) {
      setAvailableItems([...availableItems, ...groupToRemove.items]);
      setGroups(groups.filter(g => g.id !== groupId));
    }
  };

  const moveItemToGroup = (itemType: string, groupId: string) => {
    const item = availableItems.find(i => i.type === itemType);
    if (!item) return;

    setAvailableItems(availableItems.filter(i => i.type !== itemType));
    setGroups(groups.map(g => {
      if (g.id === groupId) {
        return { ...g, items: [...g.items, item] };
      }
      return g;
    }));
  };

  const removeItemFromGroup = (itemType: string, groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const item = group.items.find(i => i.type === itemType);
    if (!item) return;

    setGroups(groups.map(g => {
      if (g.id === groupId) {
        return { ...g, items: g.items.filter(i => i.type !== itemType) };
      }
      return g;
    }));
    setAvailableItems([...availableItems, item]);
  };

  const handleConclude = () => {
    if (groups.length === 0) {
      toast.error("Crie pelo menos um grupo e adicione itens para importar.");
      return;
    }
    onImportConcluded(groups, selectedGnd);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] w-[1400px] h-[90vh] flex flex-col p-0 gap-0 bg-slate-50 overflow-hidden tour-dor-importer-content">
        <DialogHeader className="p-6 border-b bg-white shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Download className="h-6 w-6 text-primary" />
                Assistente de Importação e Agrupamento
              </DialogTitle>
              <DialogDescription className="text-base mt-1">
                Selecione o GND e organize os custos do P Trab em grupos para o DOR.
              </DialogDescription>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg border">
              <Button 
                variant={selectedGnd === 3 ? "default" : "ghost"} 
                size="sm" 
                onClick={() => { setSelectedGnd(3); setGroups([]); }}
                className="px-6"
              >
                GND 3 (Custeio)
              </Button>
              <Button 
                variant={selectedGnd === 4 ? "default" : "ghost"} 
                size="sm" 
                onClick={() => { setSelectedGnd(4); setGroups([]); }}
                className="px-6"
              >
                GND 4 (Investimento)
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Coluna da Esquerda: Itens Disponíveis */}
          <div className="w-1/3 border-r bg-white flex flex-col">
            <div className="p-4 border-b bg-slate-50/50">
              <h3 className="font-bold flex items-center gap-2 text-slate-700">
                <Package className="h-4 w-4" />
                Itens Disponíveis no P Trab
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Arraste ou use as setas para agrupar</p>
            </div>
            <ScrollArea className="flex-1 p-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p>Buscando registros...</p>
                </div>
              ) : availableItems.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-600">Todos os itens foram agrupados!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableItems.map((item) => (
                    <Card key={item.type} className={cn("group hover:border-primary/50 transition-all shadow-sm", item.type === "Material de Consumo" && "tour-item-material-consumo")}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-primary/10 transition-colors">
                            <Briefcase className="h-4 w-4 text-slate-500 group-hover:text-primary" />
                          </div>
                          <div>
                            <p className="font-bold text-sm uppercase">{item.type}</p>
                            <p className="text-xs text-primary font-semibold">{formatCurrency(item.total)}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {groups.map(g => (
                            <Button 
                              key={g.id} 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 hover:bg-primary hover:text-white"
                              title={`Mover para ${g.name}`}
                              onClick={() => moveItemToGroup(item.type, g.id)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Coluna da Direita: Grupos do DOR */}
          <div className="flex-1 flex flex-col bg-slate-50/30">
            <div className="p-4 border-b bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <Input 
                  placeholder="Nome do novo grupo (ex: Aquisição de Materiais)" 
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
                />
                <Button onClick={handleAddGroup} size="sm" className="gap-2 btn-novo-grupo-dor">
                  <Plus className="h-4 w-4" />
                  Novo Grupo de Custo (DOR)
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="bg-white">{groups.length} Grupos</Badge>
              </div>
            </div>

            <ScrollArea className="flex-1 p-6">
              {groups.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-20">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <Plus className="h-8 w-8 text-slate-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-700">Nenhum grupo criado</h4>
                  <p className="text-muted-foreground max-w-xs mt-2">
                    Crie grupos para organizar como os custos aparecerão no documento oficial.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {groups.map((group) => (
                    <Card key={group.id} className="border-2 border-slate-200 shadow-md hover:border-primary/30 transition-all bg-white">
                      <CardHeader className="p-4 border-b bg-slate-50/50 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-8 bg-primary rounded-full" />
                          <CardTitle className="text-base font-bold uppercase">{group.name}</CardTitle>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500 hover:bg-red-50"
                          onClick={() => handleRemoveGroup(group.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardHeader>
                      <CardContent className="p-4 min-h-[120px]">
                        {group.items.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg bg-slate-50/50">
                            <p className="text-xs text-muted-foreground">Arraste itens para este grupo</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {group.items.map((item) => (
                              <div key={item.type} className="flex items-center justify-between p-2 bg-slate-50 rounded-md border group/item">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  <span className="text-sm font-medium uppercase">{item.type}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-bold text-primary">{formatCurrency(item.total)}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-red-500"
                                    onClick={() => removeItemFromGroup(item.type, group.id)}
                                  >
                                    <Trash2 className="h-3.3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            <div className="pt-3 mt-3 border-t flex justify-between items-center">
                              <span className="text-xs font-bold text-slate-500 uppercase">Total do Grupo:</span>
                              <span className="text-base font-black text-primary">
                                {formatCurrency(group.items.reduce((acc, i) => acc + i.total, 0))}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="p-6 border-t bg-white shrink-0">
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="font-bold">Total Agrupado:</span>
                <span className="text-primary font-black">
                  {formatCurrency(groups.reduce((acc, g) => acc + g.items.reduce((ia, i) => ia + i.total, 0), 0))}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button 
                onClick={handleConclude} 
                disabled={groups.length === 0}
                className="px-8 gap-2 bg-green-600 hover:bg-green-700 btn-confirmar-importacao-dor"
              >
                <CheckCircle2 className="h-4 w-4" />
                Concluir e Importar para o DOR
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};