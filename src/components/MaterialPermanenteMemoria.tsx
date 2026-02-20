"use client";

import React from 'react';
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, RefreshCw, XCircle, Check, AlertCircle } from "lucide-react";
import { formatCodug } from "@/lib/formatUtils";
import { generateMaterialPermanenteMemoriaCalculo } from "@/lib/materialPermanenteUtils";
import { Badge } from "@/components/ui/badge";

interface MaterialPermanenteMemoriaProps {
    registro: any;
    item: any;
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
    const itemId = item.id || item.codigo_item || Math.random().toString(36).substring(7);
    const uniqueId = `${registro.id}-${itemId}`;
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
                            <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50">Editada manualmente</Badge>
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
                                onClick={() => onStartEdit(uniqueId, memoriaDisplay)} 
                                disabled={isSaving || !isPTrabEditable} 
                                className="gap-2"
                            >
                                <Pencil className="h-4 w-4" /> Editar Memória
                            </Button>
                            {hasCustomMemoria && (
                                <Button 
                                    type="button" 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => onRestore(registro.id)} 
                                    disabled={isSaving || !isPTrabEditable} 
                                    className="gap-2 text-muted-foreground hover:text-destructive"
                                >
                                    <RefreshCw className="h-4 w-4" /> Restaurar Automática
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
                                className="gap-2 bg-green-600 hover:bg-green-700"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
                            </Button>
                            <Button 
                                type="button" 
                                size="sm" 
                                variant="outline" 
                                onClick={onCancelEdit} 
                                disabled={isSaving} 
                                className="gap-2"
                            >
                                <XCircle className="h-4 w-4" /> Cancelar
                            </Button>
                        </>
                    )}
                </div>
            </div>
            
            <Card className="p-4 bg-background rounded-lg border shadow-sm">
                {isEditing ? (
                    <Textarea 
                        value={memoriaEdit} 
                        onChange={(e) => setMemoriaEdit(e.target.value)} 
                        className="min-h-[250px] font-mono text-sm focus-visible:ring-primary" 
                        placeholder="Digite a memória de cálculo personalizada..."
                    />
                ) : (
                    <div className="relative">
                        {!memoriaDisplay && (
                            <div className="flex items-center gap-2 text-muted-foreground py-4 italic">
                                <AlertCircle className="h-4 w-4" />
                                Nenhuma informação disponível para gerar a memória.
                            </div>
                        )}
                        <pre className="text-sm font-mono whitespace-pre-wrap text-foreground leading-relaxed">
                            {memoriaDisplay}
                        </pre>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default MaterialPermanenteMemoria;