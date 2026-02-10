"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil, Save, XCircle, RefreshCw, Loader2, Copy, Check, FileText } from "lucide-react";
import { ConsolidatedMaterialConsumoRecord, generateConsolidatedMaterialConsumoMemoriaCalculo } from "@/lib/materialConsumoUtils";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface MaterialConsumoMemoriaProps {
    group: ConsolidatedMaterialConsumoRecord;
    isPTrabEditable: boolean;
    isSaving: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (value: string) => void;
    handleIniciarEdicaoMemoria: (group: ConsolidatedMaterialConsumoRecord, memoriaCompleta: string) => void;
    handleCancelarEdicaoMemoria: () => void;
    handleSalvarMemoriaCustomizada: (registroId: string) => Promise<void>;
    handleRestaurarMemoriaAutomatica: (registroId: string) => Promise<void>;
}

const MaterialConsumoMemoria: React.FC<MaterialConsumoMemoriaProps> = ({
    group,
    isPTrabEditable,
    isSaving,
    editingMemoriaId,
    memoriaEdit,
    setMemoriaEdit,
    handleIniciarEdicaoMemoria,
    handleCancelarEdicaoMemoria,
    handleSalvarMemoriaCustomizada,
    handleRestaurarMemoriaAutomatica,
}) => {
    const [copied, setCopied] = useState(false);
    
    // O primeiro registro do grupo é usado para armazenar a memória customizada
    const firstRecord = group.records[0];
    const isEditing = editingMemoriaId === firstRecord.id;
    
    // 1. Memória Automática (sempre gerada)
    const memoriaAutomatica = generateConsolidatedMaterialConsumoMemoriaCalculo(group);
    
    // 2. Memória Customizada (se existir no DB)
    const memoriaCustomizadaDB = firstRecord.detalhamento_customizado;
    
    // 3. Memória a ser exibida (Customizada > Automática)
    const memoriaDisplay = memoriaCustomizadaDB || memoriaAutomatica;
    
    // 4. Verifica se a memória está customizada
    const isCustomized = !!memoriaCustomizadaDB;

    const handleCopy = () => {
        navigator.clipboard.writeText(memoriaDisplay);
        setCopied(true);
        toast.success("Memória de cálculo copiada!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className={cn(
            "overflow-hidden transition-all duration-200",
            isCustomized && !isEditing ? "border-green-500/50 shadow-md bg-green-50/10" : "border-border shadow-sm"
        )}>
            <CardHeader className="pb-3 bg-muted/30 border-b">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-bold">
                                Memória de Cálculo: {group.organizacao}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                UG: {formatCodug(group.ug)} | {group.fase_atividade}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {isCustomized && !isEditing && (
                            <Badge variant="ptrab-aprovado" className="animate-in fade-in zoom-in duration-300">
                                Customizada
                            </Badge>
                        )}
                        <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none mb-1">Total do Lote</p>
                            <p className="font-extrabold text-xl text-primary tracking-tight">
                                {formatCurrency(group.totalGeral)}
                            </p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {isEditing ? (
                    <div className="p-4 space-y-4 bg-background">
                        <Textarea
                            value={memoriaEdit}
                            onChange={(e) => setMemoriaEdit(e.target.value)}
                            rows={15}
                            className="font-mono text-xs resize-none focus-visible:ring-primary"
                            disabled={isSaving}
                            placeholder="Insira a memória de cálculo customizada..."
                        />
                        <div className="flex flex-wrap justify-end gap-2">
                            {isCustomized && (
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleRestaurarMemoriaAutomatica(firstRecord.id)}
                                    disabled={isSaving}
                                    className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Restaurar Automática
                                </Button>
                            )}
                            <Button 
                                type="button" 
                                variant="secondary" 
                                size="sm"
                                onClick={handleCancelarEdicaoMemoria}
                                disabled={isSaving}
                            >
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancelar
                            </Button>
                            <Button 
                                type="button" 
                                size="sm"
                                onClick={() => handleSalvarMemoriaCustomizada(firstRecord.id)}
                                disabled={isSaving}
                                className="bg-primary hover:bg-primary/90"
                            >
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Salvar Customizada
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="relative group">
                        {/* Botões de Ação Flutuantes (Hover) */}
                        <div className="absolute right-4 top-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <Button
                                variant="secondary"
                                size="sm"
                                className="h-8 px-3 bg-background/80 backdrop-blur-sm border shadow-sm"
                                onClick={handleCopy}
                            >
                                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                                <span className="ml-2 text-xs">{copied ? "Copiado" : "Copiar"}</span>
                            </Button>
                            
                            {isPTrabEditable && (
                                <Button 
                                    type="button" 
                                    variant="secondary" 
                                    size="sm" 
                                    className="h-8 px-3 bg-background/80 backdrop-blur-sm border shadow-sm"
                                    onClick={() => handleIniciarEdicaoMemoria(group, memoriaDisplay)}
                                    disabled={isSaving}
                                >
                                    <Pencil className="mr-2 h-3.5 w-3.5" />
                                    <span className="text-xs">{isCustomized ? "Editar" : "Customizar"}</span>
                                </Button>
                            )}
                        </div>
                        
                        <pre className="bg-slate-950 text-slate-50 p-6 overflow-x-auto text-[11px] font-mono whitespace-pre-wrap leading-relaxed selection:bg-primary/30">
                            {memoriaDisplay}
                        </pre>
                        
                        {/* Botão de Customizar visível apenas em mobile ou se não houver hover */}
                        {isPTrabEditable && !isCustomized && (
                            <div className="p-4 bg-muted/30 border-t flex justify-center md:hidden">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleIniciarEdicaoMemoria(group, memoriaDisplay)}
                                    disabled={isSaving}
                                    className="w-full"
                                >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Customizar Memória
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default MaterialConsumoMemoria;