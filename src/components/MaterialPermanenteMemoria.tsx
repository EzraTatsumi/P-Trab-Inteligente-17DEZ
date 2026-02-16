"use client";

import React from 'react';
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, RefreshCw, XCircle, Check } from "lucide-react";
import { formatCodug } from "@/lib/formatUtils";
import { generateMaterialPermanenteMemoriaCalculo } from "@/lib/materialPermanenteUtils";
import { Badge } from "@/components/ui/badge";

interface MaterialPermanenteMemoriaProps {
    registro: any;
    item: any; // Item específico para esta memória
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
    item,
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
    // O ID de edição agora precisa ser único por item se houver múltiplos no mesmo registro
    const uniqueId = `${registro.id}-${item.id}`;
    const isEditing = editingMemoriaId === uniqueId;
    
    const memoriaAutomatica = generateMaterialPermanenteMemoriaCalculo(registro, item);
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
                            <Badge variant="outline" className="text-xs">Editada manualmente</Badge>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center justify-end gap-2 shrink-0">
                    {!isEditing ? (
                        <>
                            <Button type="button" size="sm" variant="outline" onClick={() => onStartEdit(uniqueId, memoriaDisplay)} disabled={isSaving || !isPTrabEditable} className="gap-2">
                                <Pencil className="h-4 w-4" /> Editar Memória
                            </Button>
                            {hasCustomMemoria && (
                                <Button type="button" size="sm" variant="ghost" onClick={() => onRestore(registro.id)} disabled={isSaving || !isPTrabEditable} className="gap-2 text-muted-foreground">
                                    <RefreshCw className="h-4 w-4" /> Restaurar Automática
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            <Button type="button" size="sm" variant="default" onClick={() => onSave(registro.id)} disabled={isSaving} className="gap-2">
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={onCancelEdit} disabled={isSaving} className="gap-2">
                                <XCircle className="h-4 w-4" /> Cancelar
                            </Button>
                        </>
                    )}
                </div>
            </div>
            
            <Card className="p-4 bg-background rounded-lg border">
                {isEditing ? (
                    <Textarea value={memoriaEdit} onChange={(e) => setMemoriaEdit(e.target.value)} className="min-h-[250px] font-mono text-sm" />
                ) : (
                    <pre className="text-sm font-mono whitespace-pre-wrap text-foreground">{memoriaDisplay}</pre>
                )}
            </Card>
        </div>
    );
};

export default MaterialPermanenteMemoria;