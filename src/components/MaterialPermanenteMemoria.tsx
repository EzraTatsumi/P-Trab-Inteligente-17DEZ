"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, X, RotateCcw, FileText, Calculator } from "lucide-react";
import { generateMaterialPermanenteMemoria } from "@/lib/materialPermanenteUtils";
import { Badge } from "@/components/ui/badge";

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
        <Card className="border shadow-sm overflow-hidden bg-background">
            <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                        <Calculator className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col">
                        <CardTitle className="text-sm font-bold text-foreground">
                            {item?.descricao_reduzida || item?.descricao_item || "Material Permanente"}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 uppercase font-bold">
                                {registro.fase_atividade}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-medium">
                                {registro.organizacao}
                            </span>
                        </div>
                    </div>
                </div>
                {isPTrabEditable && (
                    <div className="flex gap-2">
                        {!isEditing ? (
                            <>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 px-3 text-xs font-semibold border-primary/20 hover:bg-primary/5" 
                                    onClick={() => onStartEdit(registro.id, currentMemoria)}
                                >
                                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar Memória
                                </Button>
                                {registro.detalhamento_customizado && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-8 px-3 text-xs font-semibold text-orange-600 hover:bg-orange-50" 
                                        onClick={() => onRestore(registro.id)}
                                    >
                                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restaurar
                                    </Button>
                                )}
                            </>
                        ) : (
                            <>
                                <Button 
                                    variant="default" 
                                    size="sm" 
                                    className="h-8 px-3 text-xs font-semibold bg-green-600 hover:bg-green-700" 
                                    onClick={() => onSave(registro.id)}
                                >
                                    <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar Alterações
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 px-3 text-xs font-semibold text-destructive hover:bg-destructive/5" 
                                    onClick={onCancelEdit}
                                >
                                    <X className="h-3.5 w-3.5 mr-1.5" /> Cancelar
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </CardHeader>
            <CardContent className="p-5">
                {isEditing ? (
                    <div className="space-y-2">
                        <Textarea 
                            value={memoriaEdit} 
                            onChange={(e) => setMemoriaEdit(e.target.value)} 
                            className="min-h-[150px] text-sm leading-relaxed focus-visible:ring-primary resize-none"
                            placeholder="Digite aqui a memória de cálculo detalhada..."
                        />
                        <p className="text-[10px] text-muted-foreground italic">
                            * Você está editando manualmente a memória de cálculo deste item.
                        </p>
                    </div>
                ) : (
                    <div className="relative">
                        <div className="absolute -left-2 top-0 bottom-0 w-1 bg-primary/10 rounded-full" />
                        <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap pl-4 font-medium italic">
                            {currentMemoria}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default MaterialPermanenteMemoria;