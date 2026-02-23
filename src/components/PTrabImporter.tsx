"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/formatUtils";
import { 
  GripVertical, Plus, Trash2, ArrowRight, 
  Wallet, CheckCircle2, Loader2, Search, Layers, X, ChevronRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isGhostMode } from "@/lib/ghostStore";

export interface PTrabItem {
  id: string;
  descricao: string;
  valor: number;
  gnd: number;
  natureza: string;
  uge: string;
  tableName: string;
  originalRecords: any[]; 
}

export interface DorGroup {
  id: string;
  name: string;
  items: PTrabItem[];
  total: number;
}

interface PTrabImporterProps {
  isOpen: boolean;
  onClose: () => void;
  ptrabId: string;
  onImportConcluded: (groups: DorGroup[], selectedGnd: number) => void;
  initialGroups?: DorGroup[];
}

export function PTrabImporter({ isOpen, onClose, ptrabId, onImportConcluded, initialGroups }: PTrabImporterProps) {
  const [loading, setLoading] = useState(false);
  const [allItems, setAllItems] = useState<PTrabItem[]>([]);
  const [selectedGnd, setSelectedGnd] = useState<number>(3);
  const [dorGroups, setDorGroups] = useState<DorGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [draggedItem, setDraggedItem] = useState<PTrabItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadPTrabItems = async () => {
    if (!ptrabId) return;
    setLoading(true);
    try {
      if (isGhostMode()) {
        // Dados mockados para o Tour
        if (selectedGnd === 3) {
          setAllItems([{
            id: "ghost-rec-1",
            descricao: "MATERIAL DE CONSUMO",
            valor: 1250.50,
            gnd: 3,
            natureza: "Operacional",
            uge: "1º BIS (160222)",
            tableName: "material_consumo_registros",
            originalRecords: [{ id: "ghost-rec-1", organizacao: "1º BIS", ug: "160222", valor_total: 1250.50 }]
          }]);
        } else {
          setAllItems([]);
        }
        setLoading(false);
        return;
      }

      const tables = [
        { name: 'classe_i_registros', gnd: 3, nature: 'Logístico', descField: 'categoria', label: 'Classe I - Subsistência', isClasseI: true, hasDetalhamento: false },
        { name: 'classe_ii_registros', gnd: 3, nature: 'Logístico', descField: 'categoria', label: 'Classe II - Intendência', hasDetalhamento: true },
        { name: 'classe_iii_registros', gnd: 3, nature: 'Logístico', descField: 'tipo_equipamento', label: 'Classe III - Combustíveis', hasDetalhamento: true },
        { name: 'classe_v_registros', gnd: 3, nature: 'Logístico', descField: 'categoria', label: 'Classe V - Armamento', hasDetalhamento: true },
        { name: 'classe_vi_registros', gnd: 3, nature: 'Logístico', descField: 'categoria', label: 'Classe VI - Engenharia', hasDetalhamento: true },
        { name: 'classe_vii_registros', gnd: 3, nature: 'Logístico', descField: 'categoria', label: 'Classe VII - Comunicações', hasDetalhamento: true },
        { name: 'classe_viii_saude_registros', gnd: 3, nature: 'Logístico', descField: 'categoria', label: 'Classe VIII - Saúde', hasDetalhamento: true },
        { name: 'classe_viii_remonta_registros', gnd: 3, nature: 'Logístico', descField: 'animal_tipo', label: 'Classe VIII - Remonta', hasDetalhamento: true },
        { name: 'classe_ix_registros', gnd: 3, nature: 'Logístico', descField: 'categoria', label: 'Classe IX - Motomecanização', hasDetalhamento: true },
        { name: 'diaria_registros', gnd: 3, nature: 'Operacional', descField: null, label: 'DIÁRIAS', hasDetalhamento: true },
        { 
          name: 'verba_operacional_registros', 
          gnd: 3, 
          nature: 'Operacional', 
          descField: 'detalhamento', 
          label: 'Verba Operacional / Suprimento', 
          hasDetalhamento: true,
          isVerbaOp: true 
        },
        { name: 'passagem_registros', gnd: 3, nature: 'Operacional', descField: null, label: 'PASSAGENS', hasDetalhamento: true },
        { name: 'concessionaria_registros', gnd: 3, nature: 'Operacional', descField: 'categoria', label: 'Concessionárias', hasDetalhamento: true },
        { name: 'horas_voo_registros', gnd: 3, nature: 'Operacional', descField: 'tipo_anv', label: 'Horas de Voo', hasDetalhamento: true },
        { name: 'material_consumo_registros', gnd: 3, nature: 'Operacional', descField: 'group_name', label: 'Material de Consumo', hasDetalhamento: true },
        { name: 'complemento_alimentacao_registros', gnd: 3, nature: 'Operacional', descField: 'group_name', label: 'Complemento de Alimentação', hasDetalhamento: true },
        { name: 'servicos_terceiros_registros', gnd: 3, nature: 'Operacional', descField: 'categoria', label: 'Serviços de Terceiros', hasDetalhamento: true },
        { name: 'material_permanente_registros', gnd: 4, nature: 'Operacional', descField: 'categoria', label: 'Material Permanente', hasDetalhamento: true }
      ];

      const aggregatedMap: Record<string, PTrabItem> = {};

      for (const table of tables) {
        const selectFields = ['id', 'organizacao', 'ug'];
        
        if (table.hasDetalhamento) {
          selectFields.push('detalhamento_customizado');
        }

        if (table.isClasseI) {
          selectFields.push('total_qs', 'total_qr', 'categoria');
        } else if (table.isVerbaOp) {
          selectFields.push('valor_nd_30', 'valor_nd_39', 'detalhamento');
        } else {
          selectFields.push('valor_total');
        }
        
        if (table.descField && !table.isVerbaOp) selectFields.push(table.descField);
        
        if (table.name === 'servicos_terceiros_registros' || table.name === 'material_permanente_registros') {
          selectFields.push('detalhes_planejamento');
        }

        const { data, error } = await (supabase.from(table.name as any) as any)
          .select(selectFields.join(','))
          .eq('p_trab_id', ptrabId);

        if (!error && data) {
          data.forEach((row: any) => {
            if (table.isClasseI) {
              const qs = Number(row.total_qs || 0);
              const qr = Number(row.total_qr || 0);

              if (qs > 0) {
                const desc = "SUBSISTÊNCIA (QS)";
                const key = `${table.name}-QS`;
                if (!aggregatedMap[key]) {
                  aggregatedMap[key] = { id: key, descricao: desc, valor: 0, gnd: 3, natureza: table.nature, uge: "Múltiplas OMs", tableName: table.name, originalRecords: [] };
                }
                aggregatedMap[key].valor += qs;
                aggregatedMap[key].originalRecords.push({ ...row, valor_total: qs, tipo_rancho: 'QS' });
              }

              if (qr > 0) {
                const desc = "SUBSISTÊNCIA (QR)";
                const key = `${table.name}-QR`;
                if (!aggregatedMap[key]) {
                  aggregatedMap[key] = { id: key, descricao: desc, valor: 0, gnd: 3, natureza: table.nature, uge: "Múltiplas OMs", tableName: table.name, originalRecords: [] };
                }
                aggregatedMap[key].valor += qr;
                aggregatedMap[key].originalRecords.push({ ...row, valor_total: qr, tipo_rancho: 'QR' });
              }
              return;
            }

            if (table.isVerbaOp) {
              const valor = Number(row.valor_nd_30 || 0) + Number(row.valor_nd_39 || 0);
              if (valor <= 0) return;

              const descValue = (row.detalhamento || table.label).toUpperCase();
              const key = `${table.name}-${descValue}`;

              if (!aggregatedMap[key]) {
                aggregatedMap[key] = {
                  id: key,
                  descricao: descValue,
                  valor: 0,
                  gnd: 3,
                  natureza: table.nature,
                  uge: "Múltiplas OMs",
                  tableName: table.name,
                  originalRecords: []
                };
              }

              aggregatedMap[key].valor += valor;
              aggregatedMap[key].originalRecords.push({ ...row, valor_total: valor });
              return;
            }

            if (table.name === 'material_permanente_registros' && row.detalhes_planejamento?.itens_selecionados) {
              row.detalhes_planejamento.itens_selecionados.forEach((subItem: any) => {
                const valorItem = Number(subItem.quantidade || 0) * Number(subItem.valor_unitario || 0);
                if (valorItem <= 0) return;

                const descItem = subItem.descricao_reduzida || subItem.descricao_item || "Item Permanente";
                const keyItem = `${table.name}-${row.id}-${subItem.id}`;

                aggregatedMap[keyItem] = {
                  id: keyItem,
                  descricao: descItem.toUpperCase(),
                  valor: valorItem,
                  gnd: 4,
                  natureza: table.nature,
                  uge: `${row.organizacao} (${row.ug})`,
                  tableName: table.name,
                  originalRecords: [{ ...row, valor_total: valorItem, subItem_id: subItem.id }]
                };
              });
              return;
            }

            const valor = Number(row.valor_total || 0);
            if (valor <= 0) return;

            let descValue = table.descField ? (row[table.descField] || table.label) : table.label;
            
            if (table.name === 'servicos_terceiros_registros' && row.detalhes_planejamento?.nome_servico_outros) {
              descValue = row.detalhes_planejamento.nome_servico_outros;
            }

            const isOutros = descValue.toUpperCase() === "OUTROS";
            
            if (isOutros && row.detalhamento_customizado) {
              descValue = row.detalhamento_customizado;
            }

            const key = (table.gnd === 4 || isOutros) ? `${table.name}-${row.id}` : `${table.name}-${descValue}`;

            if (!aggregatedMap[key]) {
              aggregatedMap[key] = {
                id: key,
                descricao: descValue.toUpperCase(),
                valor: 0,
                gnd: table.gnd,
                natureza: table.nature,
                uge: (table.gnd === 4 || isOutros) ? `${row.organizacao} (${row.ug})` : "Múltiplas OMs",
                tableName: table.name,
                originalRecords: []
              };
            }

            aggregatedMap[key].valor += valor;
            aggregatedMap[key].originalRecords.push({ ...row, valor_total: valor });
          });
        }
      }

      setAllItems(Object.values(aggregatedMap));
    } catch (e) {
      console.error("Erro ao carregar itens:", e);
      toast.error("Falha ao carregar itens do P-Trab.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPTrabItems();
      if (initialGroups && initialGroups.length > 0) {
        setDorGroups(initialGroups);
        if (initialGroups[0].items.length > 0) {
          setSelectedGnd(initialGroups[0].items[0].gnd);
        }
      } else {
        setDorGroups([]);
      }
    }
  }, [isOpen, initialGroups, selectedGnd]);

  const availableItems = useMemo(() => {
    const alocatedIds = new Set(dorGroups.flatMap(g => g.items.map(i => i.id)));
    return allItems.filter(item => 
      item.gnd === selectedGnd && 
      !alocatedIds.has(item.id) &&
      (item.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [allItems, selectedGnd, dorGroups, searchTerm]);

  const handleDragStart = (e: React.DragEvent, item: PTrabItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropOnGroup = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    if (!draggedItem) return;

    setDorGroups(prev => prev.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          items: [...group.items, draggedItem],
          total: group.total + draggedItem.valor
        };
      }
      return group;
    }));

    setDraggedItem(null);
    if (isGhostMode()) {
      window.dispatchEvent(new CustomEvent('tour:avancar'));
    }
  };

  const moveItemToGroup = (item: PTrabItem, groupId: string) => {
    setDorGroups(prev => prev.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          items: [...group.items, item],
          total: group.total + item.valor
        };
      }
      return group;
    }));
    if (isGhostMode()) {
      window.dispatchEvent(new CustomEvent('tour:avancar'));
    }
  };

  const returnItemToSource = (groupId: string, item: PTrabItem) => {
    setDorGroups(prev => prev.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          items: group.items.filter(i => i.id !== item.id),
          total: group.total - item.valor
        };
      }
      return group;
    }));
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup: DorGroup = {
      id: Math.random().toString(36).substr(2, 9),
      name: newGroupName.toUpperCase(),
      items: [],
      total: 0
    };
    setDorGroups([...dorGroups, newGroup]);
    setNewGroupName("");
    if (isGhostMode()) {
      window.dispatchEvent(new CustomEvent('tour:avancar'));
    }
  };

  const deleteGroup = (groupId: string) => {
    setDorGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const handleFinalize = () => {
    if (dorGroups.length === 0) {
      toast.error("Crie pelo menos um grupo e aloque tipos de custo antes de finalizar.");
      return;
    }
    onImportConcluded(dorGroups, selectedGnd);
    if (isGhostMode()) {
      window.dispatchEvent(new CustomEvent('tour:avancar'));
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] w-[1400px] h-[90vh] flex flex-col p-0 gap-0 bg-slate-50 overflow-hidden tour-dor-importer-content">
        <DialogHeader className="p-6 border-b bg-white shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-800">
                Importação e Agrupamento de Dados do P-Trab
              </DialogTitle>
              <DialogDescription className="text-slate-500 mt-1">
                Selecione o GND, crie grupos para o DOR e organize os tipos de custo.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-3 bg-white border-b flex items-center gap-4 shrink-0">
          <span className="text-xs font-black text-slate-400 uppercase">Filtrar por Natureza:</span>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => { setSelectedGnd(3); setDorGroups([]); }}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                selectedGnd === 3 ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"
              )}
            >
              GND 3 (Custeio)
            </button>
            <button 
              onClick={() => { setSelectedGnd(4); setDorGroups([]); }}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                selectedGnd === 4 ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"
              )}
            >
              GND 4 (Investimento)
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-12 divide-x divide-slate-200">
          <div className="col-span-4 bg-slate-100/30 flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b bg-slate-100/50 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Classes / Tipos de Custo</h3>
                <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-full font-bold text-slate-600">
                  {availableItems.length} disponíveis
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Filtrar tipos..." 
                  className="pl-9 h-9 bg-white border-slate-200 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p className="text-sm">Consolidando tipos...</p>
                </div>
              ) : availableItems.length === 0 ? (
                <div className="text-center py-10 text-slate-400 italic text-sm">
                  {searchTerm ? "Nenhum tipo corresponde à busca." : "Todos os tipos foram alocados!"}
                </div>
              ) : (
                <div className="space-y-2">
                  {availableItems.map(item => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item)}
                      className={cn(
                        "group bg-white p-3 rounded-lg border border-slate-200 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-md transition-all flex flex-col gap-1",
                        draggedItem?.id === item.id && "opacity-50 border-dashed border-primary bg-primary/5",
                        item.descricao === "MATERIAL DE CONSUMO" && "tour-item-material-consumo"
                      )}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-start gap-2 flex-1 overflow-hidden">
                          <GripVertical className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" />
                          <p className="text-[11px] font-bold text-slate-700 leading-tight uppercase break-words">{item.descricao}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 whitespace-nowrap shrink-0">{formatCurrency(item.valor)}</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {dorGroups.map(g => (
                              <Button 
                                key={g.id} 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 hover:bg-primary hover:text-white"
                                title={`Mover para ${g.name}`}
                                onClick={() => moveItemToGroup(item, g.id)}
                              >
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 ml-5">
                        <Layers className="h-3 w-3 text-slate-400" />
                        <span className="text-[9px] text-slate-500 font-medium">
                          {item.gnd === 4 
                            ? item.uge 
                            : `${item.originalRecords.length} registros consolidados`
                          }
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="col-span-8 bg-white flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b bg-white shadow-sm shrink-0">
              <div className="flex gap-2 items-end">
                <div className="flex-1 max-w-md">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block ml-1">Novo Grupo de Custo (DOR)</label>
                  <div className="flex gap-2 tour-group-creation-container">
                    <Input 
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Ex: COMPLEMENTO DE ALIMENTAÇÃO"
                      className="border-slate-200 focus-visible:ring-primary h-10 uppercase text-sm tour-input-nome-grupo"
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                    />
                    <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()} className="h-10 px-4 btn-novo-grupo-dor">
                      <Plus className="h-4 w-4 mr-2" /> Criar Grupo
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-6 bg-slate-50/50">
              {dorGroups.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20 border-2 border-dashed border-slate-200 rounded-2xl m-4">
                  <h4 className="font-bold text-slate-500">Nenhum grupo criado para GND {selectedGnd}</h4>
                  <p className="text-sm max-w-[300px] text-center mt-1">Crie um grupo acima para começar a organizar as despesas do DOR.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-24">
                  {dorGroups.map(group => (
                    <div 
                      key={group.id}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnGroup(e, group.id)}
                      className={cn(
                        "bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col transition-all overflow-hidden h-fit min-h-[180px]",
                        "hover:border-primary/40 hover:shadow-md"
                      )}
                    >
                      <div className="p-3.5 bg-slate-50 border-b flex justify-between items-center">
                        <div className="overflow-hidden">
                          <h4 className="font-black text-xs text-slate-800 uppercase truncate pr-2">{group.name}</h4>
                          <p className="text-[9px] text-slate-500 font-bold mt-0.5">{group.items.length} TIPOS ALOCADOS</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0" onClick={() => deleteGroup(group.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="p-2 space-y-1.5 flex-1">
                        {group.items.length === 0 ? (
                          <div className="h-24 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-50 rounded-lg">
                            <ArrowRight className="h-5 w-5 mb-1 opacity-30" />
                            <span className="text-[10px] font-bold uppercase tracking-tighter">Solte tipos aqui</span>
                          </div>
                        ) : (
                          group.items.map(item => (
                            <div key={item.id} className="flex justify-between items-center p-2 bg-slate-50/80 rounded border border-slate-100 text-[10px] group/item">
                              <div className="flex flex-col flex-1 overflow-hidden pr-2">
                                <span className="font-bold text-slate-700 uppercase break-words" title={item.descricao}>{item.descricao}</span>
                                <span className="text-[8px] text-slate-400 truncate">
                                  {item.gnd === 4 ? item.uge : `${item.originalRecords.length} registros`}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-black text-slate-900">{formatCurrency(item.valor)}</span>
                                <button 
                                  onClick={() => returnItemToSource(group.id, item)}
                                  className="text-slate-300 hover:text-red-500 transition-colors"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-auto p-3 bg-primary/5 border-t border-primary/10 flex justify-between items-center">
                        <span className="text-[9px] font-black uppercase text-primary/60">Subtotal</span>
                        <span className="font-black text-base text-primary">{formatCurrency(group.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-white flex justify-between items-center w-full sm:justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
              <Wallet className="h-4 w-4 text-slate-400" />
              <span>Total Alocado (GND {selectedGnd}): <b className="text-slate-900 text-sm ml-1">{formatCurrency(dorGroups.reduce((acc, g) => acc + g.total, 0))}</b></span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={handleFinalize} 
              disabled={dorGroups.length === 0}
              className="px-8 font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 btn-confirmar-importacao-dor"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirmar Importação
            </Button>
            <Button variant="outline" onClick={onClose} className="font-bold text-xs uppercase">Cancelar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}