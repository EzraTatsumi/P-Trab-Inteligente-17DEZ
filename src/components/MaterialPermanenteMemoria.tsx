"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, RotateCcw, Save, X, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
    onRestore
}) => {
    const isEditing = editingMemoriaId === registro.id;
    const currentMemoria = registro.detalhamento_customizado || generateMaterialPermanenteMemoria(registro);

    return (
        <Card className="border-l-4 border-l-green-600 shadow-sm">
            <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0 bg-muted/30">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-green-600" />
                    Memória: {registro.organizacao} - {registro.categoria}
                </CardTitle>
                {isPTrabEditable && (
                    <div className="flex gap-2">
                        {!isEditing ? (
                            <>
                                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onStartEdit(registro.id, currentMemoria)}>
                                    <Pencil className="h-3 w-3 mr-1" /> Editar
                                </Button>
                                {registro.detalhamento_customizado && (
                                    <Button variant="ghost" size="sm" className="h-8 text-xs text-orange-600" onClick={() => onRestore(registro.id)}>
                                        <RotateCcw className="h-3 w-3 mr-1" /> Restaurar
                                    </Button>
                                )}
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" size="sm" className="h-8 text-xs text-green-600" onClick={() => onSave(registro.id)}>
                                    <Save className="h-3 w-3 mr-1" /> Salvar
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={onCancelEdit}>
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
                        className="font-mono text-xs min-h-[200px] bg-white"
                    />
                ) : (
                    <pre className="font-mono text-[11px] whitespace-pre-wrap bg-muted/20 p-3 rounded border leading-relaxed">
                        {currentMemoria}
                    </pre>
                )}
            </CardContent>
        </Card>
    );
};

export default MaterialPermanenteMemoria;