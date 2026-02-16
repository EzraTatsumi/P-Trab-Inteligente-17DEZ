"use client";

import React from 'react';
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, RefreshCw, XCircle, Check } from "lucide-react";
import { formatCodug } from "@/lib/formatUtils";
import { generateMaterialPermanenteMemoria } from "@/lib/materialPermanenteUtils";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MaterialPermanenteMemoriaProps {
    registro: any;
    isPTrabEditable: boolean;
    isSaving?: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (value: string) => void;
    onStartEdit: (id: string, text: string) => void;
    onCancelEdit: () => void;
    onSave: (id: string) => Promise<void>;
    onRestore: (id: string) => Promise<void>;
}

const MaterialPermanenteMemoria: React.FC<MaterialPermanenteMemoriaProps> = ({
    registro,
    isPTrabEditable,
    isSaving = false,
    editingMemoriaId,
    memoriaEdit,
    setMemoriaEdit,
    onStartEdit,
    onCancelEdit,
    onSave,
    onRestore,
}) => {
    const isEditing = editingMemoriaId === registro.id;
    const item = registro.detalhes_planejamento?.item_unico || registro.detalhes_planejamento?.itens_selecionados?.[0];
    
    const memoriaAutomatica = generateMaterialPermanenteMemoria(registro, item);
    const memoriaDisplay = registro.detalhamento_customizado || memoriaAutomatica;
    const hasCustomMemoria = !!registro.detalhamento_customizado;

    return (
        <div className="space-y-4 border p-4 rounded-lg bg-muted/30">
            <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-semibold text-foreground">
                            {registro.organizacao} (UG: {formatCodug(registro.ug)})
                        </h4>
                        <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 uppercase font-bold">
                            {item?.descricao_reduzida || item?.descricao_item || "Material Permanente"}
                        </Badge>
                        {hasCustomMemoria && !isEditing && (
                            <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200 uppercase font-bold">
                                Editada manualmente
                            </Badge>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center justify-end gap-2 shrink-0">
                    {!isEditing ? (
                        <>
                            <Button 
                                type="button" 
                                size="sm" 
                                variant="outline" 
                                onClick={() => onStartEdit(registro.id, memoriaDisplay)} 
                                disabled={isSaving || !isPTrabEditable} 
                                className="h-8 gap-2 text-xs font-semibold border-primary/20 hover:bg-primary/5"
                            >
                                <Pencil className="h-3.5 w-3.5" /> Editar Memória
                            </Button>
                            {hasCustomMemoria && (
                                <Button 
                                    type="button" 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => onRestore(registro.id)} 
                                    disabled={isSaving || !isPTrabEditable} 
                                    className="h-8 gap-2 text-xs font-semibold text-orange-600 hover:bg-orange-50"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" /> Restaurar Automática
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            <Button 
                                type="button" 
                                size="sm" 
                                variant="default" 
                                onClick={() => onSave(registro.id)} 
                                disabled={isSaving} 
                                className="h-8 gap-2 text-xs font-semibold bg-green-600 hover:bg-green-700"
                            >
                                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Salvar
                            </Button>
                            <Button 
                                type="button" 
                                size="sm" 
                                variant="outline" 
                                onClick={onCancelEdit} 
                                disabled={isSaving} 
                                className="h-8 gap-2 text-xs font-semibold text-destructive hover:bg-destructive/5"
                            >
                                <XCircle className="h-3.5 w-3.5" /> Cancelar
                            </Button>
                        </>
                    )}
                </div>
            </div>
            
            <Card className="p-5 bg-background rounded-lg border shadow-sm">
                {isEditing ? (
                    <div className="space-y-2">
                        <Textarea 
                            value={memoriaEdit} 
                            onChange={(e) => setMemoriaEdit(e.target.value)} 
                            className="min-h-[200px] font-mono text-sm leading-relaxed focus-visible:ring-primary resize-none" 
                            placeholder="Digite aqui a memória de cálculo detalhada..."
                        />
                        <p className="text-[10px] text-muted-foreground italic">
                            * Você está editando manualmente a memória de cálculo deste item.
                        </p>
                    </div>
                ) : (
                    <div className="relative">
                        <pre className="text-sm font-medium italic whitespace-pre-wrap text-foreground/80 leading-relaxed">
                            {memoriaDisplay}
                        </pre>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default MaterialPermanenteMemoria;