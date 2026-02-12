"use client";

import React from 'react';
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, RefreshCw, XCircle, Check } from "lucide-react";
import { formatCodug } from "@/lib/formatUtils";
import { ServicoTerceiroRegistro, generateServicoMemoriaCalculo } from "@/lib/servicosTerceirosUtils";
import { Badge } from "@/components/ui/badge";

interface ServicosTerceirosMemoriaProps {
    registro: ServicoTerceiroRegistro;
    isPTrabEditable: boolean;
    isSaving: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (value: string) => void;
    onStartEdit: (id: string, text: string) => void;
    onCancelEdit: () => void;
    onSave: (id: string) => Promise<void>;
    onRestore: (id: string) => Promise<void>;
}

const ServicosTerceirosMemoria: React.FC<ServicosTerceirosMemoriaProps> = ({
    registro,
    isPTrabEditable,
    isSaving,
    editingMemoriaId,
    memoriaEdit,
    setMemoriaEdit,
    onStartEdit,
    onCancelEdit,
    onSave,
    onRestore,
}) => {
    const isEditing = editingMemoriaId === registro.id;
    const context = {
        organizacao: registro.organizacao,
        efetivo: registro.efetivo,
        dias_operacao: registro.dias_operacao,
        fase_atividade: registro.fase_atividade
    };

    const memoriaAutomatica = generateServicoMemoriaCalculo(registro, context);
    const memoriaDisplay = registro.detalhamento_customizado || memoriaAutomatica;
    const currentText = isEditing ? memoriaEdit : memoriaDisplay;

    return (
        <div className="space-y-4 border p-4 rounded-lg bg-muted/30">
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <h4 className="font-bold text-foreground">{registro.organizacao}</h4>
                        <Badge variant="outline" className="capitalize">
                            {registro.categoria.replace('-', ' ')}
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {registro.efetivo} militares | {registro.dias_operacao} dias | {registro.fase_atividade}
                    </p>
                </div>
                
                <div className="flex gap-2">
                    {!isEditing ? (
                        <>
                            <Button size="sm" variant="outline" onClick={() => onStartEdit(registro.id, memoriaDisplay)} disabled={!isPTrabEditable}>
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                            </Button>
                            {registro.detalhamento_customizado && (
                                <Button size="sm" variant="ghost" onClick={() => onRestore(registro.id)} disabled={!isPTrabEditable}>
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            <Button size="sm" onClick={() => onSave(registro.id)} disabled={isSaving}>
                                <Check className="h-4 w-4 mr-2" /> Salvar
                            </Button>
                            <Button size="sm" variant="outline" onClick={onCancelEdit}>
                                <XCircle className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
            </div>
            
            <Card className="p-4 bg-background font-mono text-xs">
                {isEditing ? (
                    <Textarea 
                        value={memoriaEdit} 
                        onChange={(e) => setMemoriaEdit(e.target.value)} 
                        className="min-h-[200px]"
                    />
                ) : (
                    <pre className="whitespace-pre-wrap">{currentText}</pre>
                )}
            </Card>
        </div>
    );
};

export default ServicosTerceirosMemoria;