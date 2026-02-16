"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, X, RotateCcw, FileText } from "lucide-react";
import { generateMaterialPermanenteMemoria } from "@/lib/materialPermanenteUtils";

interface MaterialPermanenteMemoriaProps {
    registro: any;
    isPTrabEditable: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (val: string) => void;
    onStartEdit: (id: string, text: string) => void;
    onCancelEdit: () => void;
    onSave: (id: string) => Promise<void>;
    onRestore: (id: string) => Promise<void>;
}

const MaterialPermanenteMemoria: React.FC<MaterialPermanenteMemoriaProps> = ({
    registro,
    isPTrabEditable,
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
    
    const defaultMemoria = generateMaterialPermanenteMemoria(registro, item);
    const currentMemoria = registro.detalhamento_customizado || defaultMemoria;

    return (
        <Card className="border-l-4 border-l-primary shadow-sm overflow-hidden">
            <CardHeader className="py-3 bg-muted/30 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-bold uppercase">
                        {item?.descricao_reduzida || item?.descricao_item || "Material Permanente"}
                    </CardTitle>
                </div>
                {isPTrabEditable && (
                    <div className="flex gap-1">
                        {!isEditing ? (
                            <>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onStartEdit(registro.id, currentMemoria)}>
                                    <Pencil className="h-3 w-3 mr-1" /> Editar
                                </Button>
                                {registro.detalhamento_customizado && (
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-orange-600" onClick={() => onRestore(registro.id)}>
                                        <RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão
                                    </Button>
                                )}
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-green-600" onClick={() => onSave(registro.id)}>
                                    <Save className="h-3 w-3 mr-1" /> Salvar
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={onCancelEdit}>
                                    <X className="h-3 w-3 mr-1" /> Cancelar
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </CardHeader>
            <CardContent className="p-4">
                {isEditing ? (
                    <Textarea 
                        value={memoriaEdit} 
                        onChange={(e) => setMemoriaEdit(e.target.value)} 
                        className="min-h-[120px] text-sm leading-relaxed"
                        placeholder="Descreva a memória de cálculo..."
                    />
                ) : (
                    <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap italic">
                        {currentMemoria}
                    </p>
                )}
                <div className="mt-3 pt-3 border-t border-border/50 flex justify-between items-center text-[10px] text-muted-foreground uppercase font-semibold">
                    <span>OM: {registro.organizacao}</span>
                    <span>Fase: {registro.fase_atividade}</span>
                </div>
            </CardContent>
        </Card>
    );
};

export default MaterialPermanenteMemoria;