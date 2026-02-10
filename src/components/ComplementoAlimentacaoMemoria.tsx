"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, XCircle, Save, RefreshCw, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ComplementoAlimentacaoRegistro, generateComplementoMemoriaCalculo } from "@/lib/complementoAlimentacaoUtils";

interface Props {
    registro: ComplementoAlimentacaoRegistro;
    context: {
        organizacao: string;
        ug: string;
        efetivo: number;
        dias_operacao: number;
        fase_atividade: string;
    };
    isPTrabEditable: boolean;
    isSaving: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (val: string) => void;
    handleIniciarEdicaoMemoria: (id: string, text: string) => void;
    handleCancelarEdicaoMemoria: () => void;
    handleSalvarMemoriaCustomizada: (id: string) => void;
    handleRestaurarMemoriaAutomatica: (id: string) => void;
}

const ComplementoAlimentacaoMemoria = ({
    registro,
    context,
    isPTrabEditable,
    isSaving,
    editingMemoriaId,
    memoriaEdit,
    setMemoriaEdit,
    handleIniciarEdicaoMemoria,
    handleCancelarEdicaoMemoria,
    handleSalvarMemoriaCustomizada,
    handleRestaurarMemoriaAutomatica
}: Props) => {
    const isEditing = editingMemoriaId === registro.id;
    const memoriaAutomatica = generateComplementoMemoriaCalculo(registro, context);
    const memoriaExibicao = registro.detalhamento_customizado || memoriaAutomatica;

    return (
        <Card key={registro.id} className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Memória de Cálculo
                    <Badge variant="outline" className="ml-2 text-[10px] uppercase font-bold border-primary/30 text-primary">
                        {registro.group_name}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                        {registro.categoria_complemento}
                    </Badge>
                </CardTitle>
                <div className="flex gap-2">
                    {!isEditing ? (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleIniciarEdicaoMemoria(registro.id, memoriaExibicao)}
                                disabled={!isPTrabEditable || isSaving}
                                className="h-8 px-2 text-xs"
                            >
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                Editar
                            </Button>
                            {registro.detalhamento_customizado && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRestaurarMemoriaAutomatica(registro.id)}
                                    disabled={!isPTrabEditable || isSaving}
                                    className="h-8 px-2 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                >
                                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                    Restaurar
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSalvarMemoriaCustomizada(registro.id)}
                                disabled={isSaving}
                                className="h-8 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                                <Save className="h-3.5 w-3.5 mr-1" />
                                Salvar
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelarEdicaoMemoria}
                                disabled={isSaving}
                                className="h-8 px-2 text-xs"
                            >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Cancelar
                            </Button>
                        </>
                    )}
                </div>
            </CardHeader>
            <CardContent className="py-2">
                {isEditing ? (
                    <Textarea
                        value={memoriaEdit}
                        onChange={(e) => setMemoriaEdit(e.target.value)}
                        className="min-h-[120px] text-xs font-mono bg-white"
                        placeholder="Edite a memória de cálculo aqui..."
                    />
                ) : (
                    <div className="relative group">
                        <pre className="text-xs whitespace-pre-wrap font-sans bg-muted/30 p-3 rounded border border-muted-foreground/10 leading-relaxed">
                            {memoriaExibicao}
                        </pre>
                        {registro.detalhamento_customizado && (
                            <div className="absolute top-2 right-2">
                                <Badge variant="secondary" className="text-[9px] opacity-70">Editado</Badge>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ComplementoAlimentacaoMemoria;